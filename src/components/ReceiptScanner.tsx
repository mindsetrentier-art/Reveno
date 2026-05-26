import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Check, RefreshCw, Sparkles, Download, FileText, Move } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { cn } from '../lib/utils';
import { CategoryItem } from '../context/CompanyContext';
import { MONTHS, YEARS } from '../constants';

interface ReceiptScannerProps {
  categories: CategoryItem[];
  onScanResult: (result: {
    month: string;
    year: number;
    breakdown: Record<string, number>;
    total: number;
    merchant: string;
  }) => void;
  onClose: () => void;
}

type FilterType = 'original' | 'grayscale' | 'contrast';

export default function ReceiptScanner({ categories, onScanResult, onClose }: ReceiptScannerProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('original');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrResult, setOcrResult] = useState<any | null>(null);
  
  // Crop points (expressed as percentage of image width/height: [x, y])
  const [points, setPoints] = useState<number[][]>([
    [10, 10], // Top-Left
    [90, 10], // Top-Right
    [90, 90], // Bottom-Right
    [10, 90], // Bottom-Left
  ]);
  const [activePointIdx, setActivePointIdx] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<CanvasRenderingContext2D | null>(null);
  const containerRef = useRef<HTMLCanvasElement>(null);

  // Initialize camera
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setStream(mediaStream);
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      alert("Impossible d'accéder à la caméra. Veuillez réessayer ou télécharger une image.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stream]);

  // Handle capture photo
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const internalCanvas = document.createElement('canvas');
    internalCanvas.width = videoRef.current.videoWidth || 640;
    internalCanvas.height = videoRef.current.videoHeight || 480;
    
    const ctx = internalCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = internalCanvas.toDataURL('image/jpeg', 0.9);
      setCapturedImage(dataUrl);
      stopCamera();
      
      // Attempt generic auto framing: tight border inside 5% margin
      setPoints([
        [15, 12],
        [85, 12],
        [85, 88],
        [15, 88],
      ]);
    }
  };

  // Pre-selected file upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
        stopCamera();
        setPoints([
          [15, 12],
          [85, 12],
          [85, 88],
          [15, 88],
        ]);
      };
      reader.readAsDataURL(file);
    }
  };

  // Perform document framing/crop and filtering
  const getProcessedCanvas = (): HTMLCanvasElement => {
    const img = new Image();
    img.src = capturedImage || '';
    
    const outputCanvas = document.createElement('canvas');
    const ctx = outputCanvas.getContext('2d');
    
    if (!ctx) return outputCanvas;

    // Set standard size for compiled receipt matching bounds
    outputCanvas.width = 600;
    outputCanvas.height = 800;

    // For simplicity, we warp/crop the bounding box specified by points
    // To make a stable document scan in pure JS, we find bounding coordinates
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    const minX = Math.max(0, Math.min(...xs)) / 100;
    const maxX = Math.min(100, Math.max(...xs)) / 100;
    const minY = Math.max(0, Math.min(...ys)) / 100;
    const maxY = Math.min(100, Math.max(...ys)) / 100;

    const sourceX = minX * img.naturalWidth;
    const sourceY = minY * img.naturalHeight;
    const sourceWidth = (maxX - minX) * img.naturalWidth;
    const sourceHeight = (maxY - minY) * img.naturalHeight;

    ctx.drawImage(
      img,
      sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, outputCanvas.width, outputCanvas.height
    );

    // Apply scanned style filters
    const imgData = ctx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
    const data = imgData.data;

    if (activeFilter === 'grayscale') {
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = avg;     // R
        data[i + 1] = avg; // G
        data[i + 2] = avg; // B
      }
      ctx.putImageData(imgData, 0, 0);
    } else if (activeFilter === 'contrast') {
      // Document high contrast binarization approximation
      for (let i = 0; i < data.length; i += 4) {
        const grayscale = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        // Binarize based on standard threshold
        const val = grayscale > 120 ? 255 : 30;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }
      ctx.putImageData(imgData, 0, 0);
    }

    return outputCanvas;
  };

  // Download PDF scan compiled with jsPDF
  const downloadPDF = () => {
    try {
      const compiledCanvas = getProcessedCanvas();
      const imgData = compiledCanvas.toDataURL('image/jpeg', 0.95);
      
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(14);
      doc.text("REVENO - DOCUMENT SCAN", 15, 12);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Généré le : ${new Date().toLocaleString()}`, 15, 17);

      // Add a clean visual separator line
      doc.setDrawColor(220, 220, 215);
      doc.setLineWidth(0.5);
      doc.line(15, 20, 195, 20);

      // Embed scanned image
      doc.addImage(imgData, 'JPEG', 15, 24, 180, 240);
      
      doc.save(`Scan_Reveno_${Date.now()}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'exportation du PDF.");
    }
  };

  // Submit to Gemini back-end parsing
  const analyzeWithAI = async () => {
    setIsAnalyzing(true);
    try {
      const compiledCanvas = getProcessedCanvas();
      const base64Data = compiledCanvas.toDataURL('image/jpeg').split(',')[1];

      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Data,
          categories
        })
      });

      if (!res.ok) throw new Error("Échec de la réponse serveur.");
      
      const parsedData = await res.json();
      setOcrResult(parsedData);
    } catch (err) {
      console.error("AI receipt scan error:", err);
      alert("L'analyse a échoué. Veuillez saisir les montants manuellement ou réessayer.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyResult = () => {
    if (ocrResult) {
      onScanResult({
        month: ocrResult.month,
        year: ocrResult.year,
        breakdown: ocrResult.breakdown || {},
        total: ocrResult.total || 0,
        merchant: ocrResult.merchant || 'Reçu de Facture'
      });
      onClose();
    }
  };

  // Handles manual framing layout markers
  const handleMouseDown = (pointIdx: number) => {
    setActivePointIdx(pointIdx);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activePointIdx === null || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    // Convert client coords back to percentages inside container
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));

    const updated = [...points];
    updated[activePointIdx] = [Math.round(x), Math.round(y)];
    setPoints(updated);
  };

  const handleMouseUp = () => {
    setActivePointIdx(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div 
        className="bg-white w-full max-w-4xl rounded-[32px] border border-outline-variant shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Header */}
        <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-[#F9F9F6]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#5A5A40]/10 flex items-center justify-center text-[#5A5A40]">
              <Camera size={20} />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-on-surface">Numériseur Intelligent de Justificatifs</h3>
              <p className="text-xs text-on-surface-variant">Cadrez vos reçus avec précision, exportez en PDF et préremplissez vos entrées avec l'IA.</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2.5 hover:bg-neutral-100 rounded-full text-on-surface-variant transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Workspace */}
        <div className="flex-grow overflow-y-auto p-6 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-8">
          
          {/* Left Viewport (Streamer or cropper canvas) */}
          <div className="md:col-span-7 flex flex-col justify-center items-center bg-zinc-950 rounded-2xl overflow-hidden relative border border-outline-variant p-4 min-h-[350px]">
            {isCameraActive ? (
              <div className="w-full h-full flex flex-col items-center relative select-none">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline
                  className="w-full h-auto max-h-[380px] rounded-xl object-cover scale-x-[-1]" 
                />
                <div className="absolute inset-0 border-[3px] border-dashed border-white/40 pointer-events-none rounded-xl m-10 flex flex-col justify-between p-4">
                  <div className="flex justify-between">
                    <div className="w-6 h-6 border-t-4 border-l-4 border-white"></div>
                    <div className="w-6 h-6 border-t-4 border-r-4 border-white"></div>
                  </div>
                  <div className="flex justify-between">
                    <div className="w-6 h-6 border-b-4 border-l-4 border-white"></div>
                    <div className="w-6 h-6 border-b-4 border-r-4 border-white"></div>
                  </div>
                </div>
                <button
                  onClick={capturePhoto}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 w-14 h-14 bg-white hover:bg-neutral-100 border-4 border-neutral-300 rounded-full flex items-center justify-center cursor-pointer shadow-lg active:scale-95 transition-all text-black"
                >
                  <div className="w-10 h-10 bg-[#5A5A40] rounded-full" />
                </button>
              </div>
            ) : capturedImage ? (
              // Framing viewport with handles
              <div 
                ref={containerRef as any}
                className="relative w-full aspect-[4/3] max-w-[480px] bg-cover bg-center rounded-xl overflow-hidden shadow-2xl"
                style={{ backgroundImage: `url(${capturedImage})` }}
              >
                {/* SVG Overlay to draw framing lines */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <polygon 
                    points={points.map(p => `${p[0]}%,${p[1]}%`).join(' ')} 
                    fill="rgba(90, 90, 64, 0.15)" 
                    stroke="#5A5A40" 
                    strokeWidth="2.5"
                    strokeDasharray="4 4"
                  />
                </svg>

                {/* Handles */}
                {points.map((p, idx) => (
                  <button
                    key={idx}
                    onMouseDown={() => handleMouseDown(idx)}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-white border-2 border-[#5A5A40] rounded-full flex items-center justify-center shadow-lg cursor-move hover:scale-110 active:scale-90 transition-transform"
                    style={{ left: `${p[0]}%`, top: `${p[1]}%` }}
                  >
                    <Move size={10} className="text-[#5A5A40]" />
                  </button>
                ))}

                {/* Corner instructions */}
                <span className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md">
                  Faites glisser les coins pour centrer
                </span>
              </div>
            ) : (
              // Empty selection state
              <div className="text-center p-8 flex flex-col items-center">
                <Sparkles className="text-zinc-500 mb-4 opacity-40 animate-pulse" size={44} />
                <p className="text-sm font-semibold tracking-wide text-zinc-300 mb-6 font-display">Choisissez une source de numérisation</p>
                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                  <button
                    onClick={startCamera}
                    className="flex items-center justify-center gap-2 px-5 py-3 bg-[#5A5A40] hover:bg-[#5A5A40]/90 text-white font-bold text-xs uppercase tracking-widest rounded-xl shadow-lg cursor-pointer transition-colors"
                  >
                    <Camera size={14} /> Activer Caméra
                  </button>
                  <label className="flex items-center justify-center gap-2 px-5 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-widest rounded-xl shadow-md cursor-pointer transition-colors border border-zinc-700">
                    <Upload size={14} /> Télécharger Image
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileUpload} 
                      className="hidden" 
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Right Viewport (Actions, Filters, and results) */}
          <div className="md:col-span-5 flex flex-col space-y-6">
            
            {/* Filters panel available once captured */}
            {capturedImage && (
              <div className="bg-[#F9F9F6] p-5 rounded-2xl border border-outline-variant">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#5A5A40] mb-3">Filtres Document</h4>
                <div className="grid grid-cols-3 gap-2">
                  {(['original', 'grayscale', 'contrast'] as FilterType[]).map((filter) => {
                    const label = filter === 'original' ? 'Original' : filter === 'grayscale' ? 'Gris Scan' : 'B&W Contraste';
                    return (
                      <button
                        key={filter}
                        onClick={() => setActiveFilter(filter)}
                        className={cn(
                          "py-2 px-3 rounded-xl text-[10px] font-bold uppercase border cursor-pointer text-center transition-all",
                          activeFilter === filter
                            ? "bg-[#5A5A40] border-[#5A5A40] text-white"
                            : "bg-white border-outline-variant text-[#5A5A40] hover:bg-outline-variant/10"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AI Control or Result View */}
            {capturedImage && (
              <div className="flex-grow flex flex-col space-y-4">
                <div className="flex gap-2">
                  <button
                    onClick={downloadPDF}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-outline-variant/10 border border-outline-variant text-primary-container font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-outline-variant/20 transition-all cursor-pointer"
                  >
                    <Download size={13} /> Sauvegarder PDF
                  </button>
                  <button
                    onClick={analyzeWithAI}
                    disabled={isAnalyzing}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-[#5A5A40] text-white font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-[#5A5A40]/90 transition-all shadow-md shadow-[#5A5A40]/10 disabled:opacity-50 cursor-pointer"
                  >
                    <Sparkles size={13} className={cn(isAnalyzing && "animate-spin")} />
                    {isAnalyzing ? "Analyse..." : "Analyser avec l'IA"}
                  </button>
                </div>

                {isAnalyzing && (
                  <div className="flex flex-col items-center justify-center p-6 bg-[#F9F9F6] rounded-2xl border border-dashed border-[#5A5A40]/30 animate-pulse">
                    <Sparkles className="animate-spin text-[#5A5A40] mb-2" size={24} />
                    <span className="text-xs font-semibold text-on-surface-variant text-center">
                      Gemini examine votre justificatif, extrait les montants de vos catégories et prépare votre livre de trésorerie...
                    </span>
                  </div>
                )}

                {ocrResult && !isAnalyzing && (
                  <div className="bg-[#5A5A40]/5 border border-[#5A5A40]/20 rounded-2xl p-5 space-y-4 flex-grow overflow-y-auto">
                    <div className="space-y-3">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#5A5A40]/60 block mb-1">Société / Marchand Extrait</span>
                        <input
                          type="text"
                          value={ocrResult.merchant}
                          onChange={(e) => setOcrResult({ ...ocrResult, merchant: e.target.value })}
                          className="w-full font-display font-bold text-sm text-on-surface bg-white border border-[#5A5A40]/20 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#5A5A40]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-[10px] font-bold text-on-surface-variant">
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-[#5A5A40]/60 block mb-1">Mois</span>
                          <select
                            value={ocrResult.month}
                            onChange={(e) => setOcrResult({ ...ocrResult, month: e.target.value })}
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
                            value={ocrResult.year}
                            onChange={(e) => setOcrResult({ ...ocrResult, year: parseInt(e.target.value) || new Date().getFullYear() })}
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
                      <span>Confiance : <strong className="text-[#059669]">{Math.round((ocrResult.confidence || 0.9) * 100)}%</strong></span>
                      <div className="text-right">
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#5A5A40]/60 mr-1.5">Total calculé :</span>
                        <strong className="font-display font-black text-xs text-primary-container">{(ocrResult.total || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</strong>
                      </div>
                    </div>

                    <div className="space-y-2 border-t border-[#5A5A40]/10 pt-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">Répartition à ventiler (modifiable)</p>
                      <div className="space-y-1.5 max-h-[170px] overflow-y-auto pr-1">
                        {categories.map(cat => {
                          const amount = ocrResult.breakdown[cat.id] || 0;
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
                                    const newBreakdown = { ...ocrResult.breakdown, [cat.id]: val };
                                    const newTotal = Object.values(newBreakdown).reduce((sum, curr) => (sum as number) + (curr as number), 0) as number;
                                    setOcrResult({ ...ocrResult, breakdown: newBreakdown, total: parseFloat(newTotal.toFixed(2)) });
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
                      onClick={handleApplyResult}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#059669] hover:bg-[#059669]/90 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-colors cursor-pointer"
                    >
                      <Check size={14} /> Remplir le Formulaire
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Camera actions when camera is not captured yet */}
            {!capturedImage && (
              <div className="bg-[#F9F9F6] p-5 rounded-3xl border border-outline-variant flex-grow flex flex-col justify-center items-center text-center space-y-4">
                <FileText size={36} className="text-[#5A5A40] opacity-40" />
                <div>
                  <h5 className="font-display font-bold text-sm text-on-surface">Capturez un reçu ou justificatif</h5>
                  <p className="text-xs text-on-surface-variant leading-relaxed mt-1">
                    Notre caméra recadre automatiquement le document et l'aligne pour l'archiver au format PDF haute résolution.
                  </p>
                </div>
              </div>
            )}

            {capturedImage && (
              <button
                onClick={() => {
                  setCapturedImage(null);
                  setOcrResult(null);
                  startCamera();
                }}
                className="w-full text-center flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#5A5A40] hover:text-[#5A5A40]/80 transition-colors py-2 cursor-pointer"
              >
                <RefreshCw size={12} /> Recommencer la capture
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
