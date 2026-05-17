import { useState, useEffect } from 'react';
import { useRevenueData, useGoalData } from '../hooks/useFinance';
import { Sparkles, RefreshCcw, TrendingUp, AlertTriangle, Lightbulb, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useCompany } from '../context/CompanyContext';

interface AIInsight {
  summary: string;
  metrics: {
    growthVelocity: string;
    predictedARR: string;
    modelConfidence: string;
  };
  alerts: {
    type: string;
    title: string;
    description: string;
    impact: string;
  }[];
  recommendations: {
    category: string;
    title: string;
    details: string;
    simulatedImpact: string;
  }[];
}

export default function AIIntelligence() {
  const { selectedCompany, revenues, goal } = useCompany();
  const [insights, setInsights] = useState<AIInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async () => {
    if (revenues.length === 0 || !selectedCompany) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revenues, goals: goal, companyName: selectedCompany.name }),
      });
      if (!response.ok) throw new Error('Institutional intelligence module failed.');
      const data = await response.json();
      setInsights(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setInsights(null); // Clear insights when company changes
    if (revenues.length > 0) {
      fetchInsights();
    }
  }, [selectedCompany?.id, revenues.length > 0]);

  return (
    <div className="space-y-12 pb-20">
      {/* Hero */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-secondary font-bold text-xs uppercase tracking-[0.2em]">
            <Sparkles size={14} className="fill-secondary" />
            <span>Module d'Intelligence</span>
          </div>
          <h1 className="font-display font-bold text-5xl text-on-surface tracking-tight leading-none">Prévisions IA</h1>
          <p className="text-on-surface-variant text-lg max-w-2xl leading-relaxed font-sans opacity-70">
            Utilisation de réseaux neuronaux profonds pour prédire vos trajectoires de croissance institutionnelle avec une précision de 98,4 %.
          </p>
        </div>
        <button 
          onClick={fetchInsights}
          disabled={loading || revenues.length === 0}
          className="flex items-center gap-2 bg-primary-container text-white font-bold px-10 py-5 rounded-2xl shadow-xl shadow-primary-container/20 hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all uppercase text-xs tracking-widest"
        >
          <RefreshCcw size={18} className={cn("transition-transform duration-1000", loading && "animate-spin")} />
          <span>Relancer les Prévisions</span>
        </button>
      </section>

      {loading && !insights ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-6">
          <div className="w-16 h-16 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-on-surface-variant font-display font-bold text-lg animate-pulse tracking-wide">Synchronisation des nœuds neuronaux...</p>
        </div>
      ) : insights ? (
        <AnimatePresence>
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-12"
          >
            {/* Top Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Vélocité de Croissance', value: insights.metrics.growthVelocity, icon: TrendingUp, color: 'text-on-background' },
                { label: 'ARR Prédit', value: insights.metrics.predictedARR, icon: RefreshCcw, color: 'text-primary-container' },
                { label: 'Confiance du Modèle', value: insights.metrics.modelConfidence, icon: Sparkles, color: 'text-secondary' },
              ].map((m, i) => (
                <div key={i} className="bg-white p-10 rounded-[32px] shadow-sm border border-outline-variant space-y-4">
                  <div className="flex justify-between items-center text-on-surface-variant">
                    <span className="text-[10px] font-black uppercase tracking-[0.25em]">{m.label}</span>
                    <m.icon size={18} className={m.color} />
                  </div>
                  <div className={cn("font-display text-5xl font-bold tracking-tight", m.color)}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* Anomaly Detection */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <h2 className="font-display font-bold text-3xl">Alertes de Détection d'Anomalies</h2>
                <span className="bg-red-500/10 text-red-600 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">{insights.alerts.length} Événements Critiques</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {insights.alerts.map((alert, i) => (
                  <div key={i} className="bg-white border border-outline-variant p-8 rounded-[32px] shadow-sm space-y-4 hover:border-primary-container/30 transition-all group">
                     <div className="flex items-center gap-2 text-primary-container font-black text-[10px] uppercase tracking-widest">
                       <AlertTriangle size={14} />
                       {alert.type}
                     </div>
                     <h3 className="font-bold font-display text-xl leading-tight group-hover:text-primary-container transition-colors">{alert.title}</h3>
                     <p className="text-sm text-on-surface-variant leading-relaxed font-light">{alert.description}</p>
                     <button className="text-secondary font-black text-[10px] uppercase tracking-widest hover:underline pt-2">Audit Complet du Segment</button>
                  </div>
                ))}
              </div>
            </section>

            {/* AI Recommendations */}
            <section className="bg-primary-container text-white p-12 rounded-[48px] shadow-xl relative overflow-hidden">
               <div className="absolute -top-20 -right-20 w-80 h-80 bg-white opacity-5 rounded-full blur-[100px] pointer-events-none"></div>
               <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-16">
                  <div className="lg:col-span-4 space-y-8">
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 bg-[#A3AD9F] rounded-full animate-pulse"></div>
                       <span className="text-xs uppercase tracking-[0.2em] opacity-70 font-semibold">Intelligence Gemini</span>
                    </div>
                    <h2 className="font-display font-bold text-4xl leading-tight">Moteur de Recommandations IA</h2>
                    <p className="text-white/70 leading-relaxed font-light text-lg">
                      Opportunités stratégiques identifiées pour optimiser votre performance fiscale basée sur la vélocité actuelle.
                    </p>
                  </div>
                  <div className="lg:col-span-8 space-y-8">
                    {insights.recommendations.map((rec, i) => (
                      <div key={i} className="flex gap-8 p-8 rounded-[32px] bg-white/5 border border-white/10 hover:bg-white/10 transition-all group">
                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-white shadow-xl shadow-black/5">
                          <TrendingUp size={24} />
                        </div>
                        <div className="space-y-3">
                           <h4 className="font-display font-bold text-2xl">{rec.title}</h4>
                           <p className="text-white/80 leading-relaxed font-light">"{rec.details}"</p>
                           <button className="flex items-center gap-3 bg-white text-primary-container px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-surface transition-all mt-4">
                             Simuler l'Impact <ArrowRight size={14} />
                           </button>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
            </section>
          </motion.div>
        </AnimatePresence>
      ) : (
        <div className="text-center py-32 bg-white rounded-[48px] border border-outline-variant shadow-sm flex flex-col items-center gap-8 relative overflow-hidden">
           <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none"></div>
           <div className="p-8 bg-background rounded-full relative z-10">
              <Sparkles size={64} className="text-secondary" />
           </div>
           <div className="space-y-4 relative z-10">
              <h3 className="font-display font-bold text-4xl">En attente de l'initialisation de la trésorerie</h3>
              <p className="text-on-surface-variant max-w-md mx-auto font-sans opacity-70 text-lg leading-relaxed px-6">
                Veuillez remplir vos registres institutionnels dans le module de suivi des revenus pour activer le moteur d'intelligence IA.
              </p>
           </div>
        </div>
      )}
    </div>
  );
}
