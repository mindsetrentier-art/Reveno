import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, X, Sparkles, Check, Play, Volume2, HelpCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { CategoryItem } from '../context/CompanyContext';
import { MONTHS, YEARS } from '../constants';

interface VoiceEntryCreatorProps {
  categories: CategoryItem[];
  onVoiceResult: (result: {
    month: string;
    year: number;
    breakdown: Record<string, number>;
    total: number;
    explanation: string;
  }) => void;
  onClose: () => void;
}

export default function VoiceEntryCreator({ categories, onVoiceResult, onClose }: VoiceEntryCreatorProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<any | null>(null);
  
  // Browser Speech Recognition instance
  const recognitionRef = useRef<any | null>(null);
  // Audio context / recorder for raw audio chunks fallback
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Check and request microphone permission
  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop stream immediately just checking permission
      stream.getTracks().forEach(track => track.stop());
      setHasPermission(true);
      return true;
    } catch (err) {
      console.error("Microphone access declined:", err);
      setHasPermission(false);
      alert("Accès microphone requis pour la dictée vocale.");
      return false;
    }
  };

  // Start recording
  const startRecording = async () => {
    const permitted = await requestMicPermission();
    if (!permitted) return;

    setLiveTranscript('');
    setParsedData(null);
    setIsRecording(true);
    audioChunksRef.current = [];

    // 1. Try to start client-side Speech Recognition for immediate user visual feedback
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.lang = 'fr-FR';
      rec.continuous = true;
      rec.interimResults = true;

      rec.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setLiveTranscript(prev => {
          const base = final || prev;
          return interim ? `${base} (en cours: ${interim})` : base;
        });
      };

      rec.onerror = (e: any) => {
        console.error("Speech recognition error:", e);
      };

      rec.onend = () => {
        // Automatically restart if record is still true
      };

      recognitionRef.current = rec;
      rec.start();
    }

    // 2. Start recording standard audio waves as a binary fallback / backup upload
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(s, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      recorder.start(250);
    } catch (err) {
      console.warn("Could not start background webm recorder:", err);
    }
  };

  // Stop recording and process
  const stopRecording = () => {
    setIsRecording(false);

    // Stop web browser speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }

    // Stop background media recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
        // Stop tracker tracks
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      } catch (e) {}
    }

    // Clean transcript by removing the "(en cours:...)" temporary markup
    setLiveTranscript(prev => prev.replace(/\(en cours:.*?\)/g, '').trim());
  };

  const processAudioOrText = async () => {
    setIsProcessing(true);
    try {
      // Clean final text
      const cleanText = liveTranscript.replace(/\(en cours:.*?\)/g, '').trim();

      let payload: any = { categories };

      if (audioChunksRef.current.length > 0 && !cleanText) {
        // If there's no live speech-to-text text captured, upload the raw audio bytes!
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        
        const base64AudioPromise = new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
          reader.readAsDataURL(audioBlob);
        });

        const base64Audio = await base64AudioPromise;
        payload.audio = base64Audio;
        payload.mimeType = 'audio/webm';
      } else {
        // Standard text transcription parsed by Gemini server-side
        payload.text = cleanText || "Ajouter 200 euros en fournitures de bureau et 50 euros en transport.";
      }

      const res = await fetch('/api/parse-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Échec d'analyse du serveur.");
      
      const data = await res.json();
      setParsedData(data);
    } catch (err) {
      console.error(err);
      alert("Une erreur technique s'est produite lors de l'analyse vocale.");
    } finally {
      setIsProcessing(false);
    }
  };

  const applyVoiceResults = () => {
    if (parsedData) {
      onVoiceResult({
        month: parsedData.month,
        year: parsedData.year,
        breakdown: parsedData.breakdown || {},
        total: parsedData.total || 0,
        explanation: parsedData.explanation || ''
      });
      onClose();
    }
  };

  useEffect(() => {
    requestMicPermission();
    return () => {
      if (isRecording) {
        stopRecording();
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-[32px] border border-outline-variant shadow-2xl p-6 md:p-8 flex flex-col space-y-6 relative overflow-hidden">
        
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full filter blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#5A5A40]/5 rounded-full filter blur-3xl pointer-events-none" />

        {/* Close */}
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 p-2 hover:bg-neutral-100 rounded-full text-on-surface-variant transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="space-y-1.5 pr-10">
          <div className="flex items-center gap-2 text-primary">
            <Volume2 size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Compagnon Vocal Reveno</span>
          </div>
          <h3 className="font-display font-black text-xl text-on-surface leading-snug">Dictée de Trésorerie Financière</h3>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Parlez naturellement pour encoder vos charges. Par exemple : <span className="italic font-medium">"J'ai dépensé 120 euros en tabac et 45 euros pour le transport ce mois-ci"</span>.
          </p>
        </div>

        {/* Recording Visualizer */}
        <div className="flex flex-col items-center justify-center py-6 bg-neutral-50 rounded-2xl border border-neutral-100 relative">
          {isRecording ? (
            <div className="flex flex-col items-center space-y-4">
              {/* Pulsing soundwave visualization */}
              <div className="flex items-center gap-1.5 h-10">
                {[1, 2, 3, 4, 5, 4, 3, 2, 1].map((scale, i) => (
                  <div 
                    key={i} 
                    className="w-1 bg-[#5A5A40] rounded-full animate-bounce"
                    style={{ 
                      height: `${scale * 10}px`,
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: '0.8s'
                    }} 
                  />
                ))}
              </div>
              <button
                onClick={stopRecording}
                className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center cursor-pointer shadow-lg active:scale-95 transition-all"
              >
                <MicOff size={24} />
              </button>
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-600 animate-pulse">Enregistrement en cours...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <button
                onClick={startRecording}
                className="w-16 h-16 rounded-full bg-[#5A5A40] hover:bg-[#5A5A40]/90 text-white flex items-center justify-center cursor-pointer shadow-lg shadow-[#5A5A40]/30 active:scale-95 transition-all"
              >
                <Mic size={24} />
              </button>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#5A5A40]">Cliquez pour parler</span>
            </div>
          )}
        </div>

        {/* Live Transcription Box */}
        {(liveTranscript || parsedData || isProcessing) && (
          <div className="space-y-4 border-t border-neutral-100 pt-4">
            <div className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Transcription de votre voix</span>
              <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-100 text-xs font-mono text-on-surface leading-relaxed max-h-[100px] overflow-y-auto">
                {liveTranscript || <span className="text-on-surface-variant/50 italic">Pas de transcription détectée... En attente de votre voix.</span>}
              </div>
            </div>

            {/* Actions for manual processing start */}
            {!isRecording && liveTranscript && !parsedData && !isProcessing && (
              <button
                onClick={processAudioOrText}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#5A5A40] text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-[#5A5A40]/90 transition-all shadow-md shadow-[#5A5A40]/10 cursor-pointer"
              >
                <Sparkles size={14} /> Analyser ma dictée avec Gemini
              </button>
            )}

            {isProcessing && (
              <div className="flex items-center justify-center gap-3 py-3 text-xs font-bold text-[#5A5A40]">
                <Sparkles className="animate-spin" size={14} />
                <span>Interprétation sémantique de vos transactions...</span>
              </div>
            )}

            {parsedData && !isProcessing && (
              <div className="p-5 bg-[#5A5A40]/5 rounded-2xl border border-[#5A5A40]/20 space-y-3.5">
                <div className="space-y-3">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#5A5A40]/60 block mb-1">Société / Marchand (Optionnel)</span>
                    <input
                      type="text"
                      placeholder="Ex: Boulangerie, Leroy Merlin..."
                      value={parsedData.merchant || ''}
                      onChange={(e) => setParsedData({ ...parsedData, merchant: e.target.value })}
                      className="w-full font-display font-bold text-sm text-on-surface bg-white border border-[#5A5A40]/20 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#5A5A40]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[10px] font-bold text-on-surface-variant">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#5A5A40]/60 block mb-1">Mois</span>
                      <select
                        value={parsedData.month}
                        onChange={(e) => setParsedData({ ...parsedData, month: e.target.value })}
                        className="w-full bg-white border border-[#5A5A40]/20 rounded-lg px-2 py-1.5 text-xs outline-none text-on-surface font-semibold"
                      >
                        {MONTHS.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#5A5A40]/60 block mb-1">Année</span>
                      <select
                        value={parsedData.year}
                        onChange={(e) => setParsedData({ ...parsedData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                        className="w-full bg-white border border-[#5A5A40]/20 rounded-lg px-2 py-1.5 text-xs outline-none text-on-surface font-semibold"
                      >
                        {YEARS.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-white/50 border border-dashed border-[#5A5A40]/10 p-2.5 rounded-xl text-[10px] font-bold text-on-surface-variant">
                  <span>Analyse vocale terminée</span>
                  <div className="text-right">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#5A5A40]/60 mr-1.5 font-bold">Total calculé :</span>
                    <strong className="font-display font-black text-xs text-primary-container">{(parsedData.total || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</strong>
                  </div>
                </div>

                {parsedData.explanation && (
                  <p className="text-[10px] text-on-surface-variant leading-relaxed bg-white/80 border border-neutral-100 p-2.5 rounded-xl italic">
                    "{parsedData.explanation}"
                  </p>
                )}

                <div className="space-y-1.5 border-t border-dashed border-[#5A5A40]/20 pt-3">
                  <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1 block">Rapprochement de vos rubriques (modifiable)</span>
                  <div className="space-y-1.5 max-h-[170px] overflow-y-auto pr-1">
                    {categories.map(cat => {
                      const amount = parsedData.breakdown[cat.id] || 0;
                      return (
                        <div key={cat.id} className="flex justify-between items-center gap-3 text-xs py-1.5 px-3 bg-white border border-[#5A5A40]/10 rounded-lg">
                          <span className="text-on-surface-variant truncate pr-2 font-bold uppercase text-[9px] tracking-wide flex items-center gap-1.5">
                            <span className={cn("w-1.5 h-1.5 rounded-full", cat.color)} />
                            {cat.label}
                          </span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={amount || ''}
                              placeholder="0"
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const newBreakdown = { ...parsedData.breakdown, [cat.id]: val };
                                const newTotal = Object.values(newBreakdown).reduce((sum, curr) => (sum as number) + (curr as number), 0) as number;
                                setParsedData({ ...parsedData, breakdown: newBreakdown, total: parseFloat(newTotal.toFixed(2)) });
                              }}
                              className="w-20 text-right font-display font-bold text-on-surface bg-neutral-50 border border-[#5A5A40]/10 rounded px-2 py-1 text-xs focus:outline-none focus:border-[#5A5A40]"
                            />
                            <span className="text-on-surface-variant font-bold text-[10px]">€</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={applyVoiceResults}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#059669] text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-[#059669]/90 transition-all cursor-pointer"
                >
                  <Check size={14} /> Préremplir ces montants
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tip text */}
        <div className="flex items-start gap-2.5 bg-neutral-50 p-3 rounded-xl">
          <HelpCircle size={14} className="text-on-surface-variant mt-0.5" />
          <span className="text-[10px] text-on-surface-variant leading-normal">
            <strong>Astuce :</strong> Vous pouvez lister plusieurs dépenses d'affilée en assemblant les mots clés. ("Par exemple: j'ai fait 15 euros de transport et 80 euros de vape.")
          </span>
        </div>

      </div>
    </div>
  );
}
