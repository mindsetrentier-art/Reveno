import { useState, useMemo } from 'react';
import { useCompany } from '../context/CompanyContext';
import { MONTHS, YEARS } from '../constants';
import { formatCurrency, cn } from '../lib/utils';
import { Target, ShieldAlert, TrendingUp, TrendingDown, CheckCircle2, AlertCircle, Save, Calendar, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { getAccessToken, googleSignIn } from '../lib/firebase';
import { createCalendarEvent } from '../lib/googleCalendar';

export default function Budget() {
  const { selectedCompany, revenues, detailedEntries, budgets, updateBudget, loading } = useCompany();
  
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const [targetRevenue, setTargetRevenue] = useState('');
  const [expenseLimit, setExpenseLimit] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasToken, setHasToken] = useState(!!getAccessToken());

  // Find existing budget for current selection
  const currentBudget = useMemo(() => {
    return budgets.find(b => b.month === selectedMonth && b.year === selectedYear);
  }, [budgets, selectedMonth, selectedYear]);

  // Sync inputs with current budget
  useMemo(() => {
    if (currentBudget) {
      setTargetRevenue(currentBudget.targetRevenue.toString());
      setExpenseLimit(currentBudget.expenseLimit.toString());
    } else {
      setTargetRevenue('');
      setExpenseLimit('');
    }
  }, [currentBudget]);

  // Calculate actuals for the selected period
  const actuals = useMemo(() => {
    if (!selectedCompany) return { income: 0, expense: 0 };
    
    const start = startOfMonth(new Date(selectedYear, MONTHS.indexOf(selectedMonth), 1));
    const end = endOfMonth(new Date(selectedYear, MONTHS.indexOf(selectedMonth), 1));

    const income = (revenues || []).filter(rev => {
      const revMonthIdx = MONTHS.indexOf(rev.month);
      const revYear = rev.createdAt?.toDate ? rev.createdAt.toDate().getFullYear() : selectedYear;
      const revDate = new Date(revYear, revMonthIdx, 15);
      return rev.month === selectedMonth && revYear === selectedYear;
    }).reduce((sum, r) => sum + (r.revenue || 0), 0);

    const expense = (detailedEntries || []).filter(entry => {
      return entry.month === selectedMonth && entry.year === selectedYear;
    }).reduce((sum, e) => sum + (e.total || 0), 0);

    return { income, expense };
  }, [selectedCompany, revenues, detailedEntries, selectedMonth, selectedYear]);

  const handleSaveBudget = async () => {
    if (!selectedCompany) return;
    setIsSaving(true);
    try {
      await updateBudget(
        selectedMonth, 
        selectedYear, 
        parseFloat(targetRevenue) || 0, 
        parseFloat(expenseLimit) || 0
      );
      alert('Budget mis à jour avec succès.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnect = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setHasToken(true);
      }
    } catch (err) {
      console.error('Connection failed:', err);
      alert('Échec de la connexion à Google.');
    }
  };

  const handleSyncToCalendar = async () => {
    if (!selectedCompany || !targetRevenue || !expenseLimit) {
      alert('Veuillez définir des objectifs avant de synchroniser.');
      return;
    }

    const confirmSync = window.confirm(
      `Synchroniser le budget de ${selectedMonth} ${selectedYear} avec Google Calendar ? Deux rappels seront créés.`
    );
    if (!confirmSync) return;

    setIsSyncing(true);
    try {
      const monthIdx = MONTHS.indexOf(selectedMonth);
      const start = new Date(selectedYear, monthIdx, 1);
      const end = new Date(selectedYear, monthIdx, 1, 1); // 1-hour event

      // Revenue Event
      await createCalendarEvent({
        summary: `Objectif Revenu: ${selectedCompany.name} - ${selectedMonth} ${selectedYear}`,
        description: `Objectif de revenu fixé à ${formatCurrency(parseFloat(targetRevenue))}.`,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      });

      // Expense Event (slightly later)
      const startExp = new Date(selectedYear, monthIdx, 1, 9);
      const endExp = new Date(selectedYear, monthIdx, 1, 10);
      await createCalendarEvent({
        summary: `Limite Dépenses: ${selectedCompany.name} - ${selectedMonth} ${selectedYear}`,
        description: `Limite de dépenses fixée à ${formatCurrency(parseFloat(expenseLimit))}.`,
        start: { dateTime: startExp.toISOString() },
        end: { dateTime: endExp.toISOString() },
      });

      alert('Budget synchronisé avec votre calendrier Google !');
    } catch (error: any) {
      console.error('Sync error:', error);
      if (error.message.includes('token')) {
        setHasToken(false);
        alert('Votre session Google a expiré. Veuillez vous reconnecter.');
      } else {
        alert('Erreur lors de la synchronisation : ' + error.message);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const revenueProgress = currentBudget?.targetRevenue ? (actuals.income / currentBudget.targetRevenue) * 100 : 0;
  const expenseProgress = currentBudget?.expenseLimit ? (actuals.expense / currentBudget.expenseLimit) * 100 : 0;

  if (loading) return <div className="p-20 text-center font-bold text-on-surface-variant animate-pulse tracking-widest uppercase">Chargement du budget...</div>;

  return (
    <div className="space-y-10 pb-20">
      <div className="border-b border-outline-variant pb-6">
        <p className="text-secondary font-bold text-xs uppercase tracking-[0.2em] mb-2">Planification Financière</p>
        <h1 className="font-display font-bold text-4xl text-on-surface">Budget Prévisionnel</h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Configuration Section */}
        <div className="lg:col-span-4 w-full lg:w-1/3 space-y-6">
          <div className="bg-white rounded-[40px] border border-outline-variant shadow-sm overflow-hidden">
            <div className="p-8 border-b border-outline-variant bg-surface/30">
              <h2 className="font-display font-bold text-xl flex items-center gap-3">
                <Target className="text-primary-container" />
                Objectifs {selectedMonth} {selectedYear}
              </h2>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="flex gap-4 mb-4">
                <select 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="flex-1 bg-background border border-outline-variant rounded-xl px-4 py-2 text-sm font-bold"
                >
                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select 
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="flex-1 bg-background border border-outline-variant rounded-xl px-4 py-2 text-sm font-bold"
                >
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Objectif de Revenu (€)</label>
                  <input 
                    type="number"
                    value={targetRevenue}
                    onChange={(e) => setTargetRevenue(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-background border border-outline-variant rounded-2xl px-6 py-4 text-xl font-display font-bold focus:border-primary-container outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Limite de Dépenses (€)</label>
                  <input 
                    type="number"
                    value={expenseLimit}
                    onChange={(e) => setExpenseLimit(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-background border border-outline-variant rounded-2xl px-6 py-4 text-xl font-display font-bold focus:border-red-500 outline-none transition-all"
                  />
                </div>
              </div>

              <button 
                onClick={handleSaveBudget}
                disabled={isSaving}
                className="w-full bg-primary-container text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:brightness-110 transition-all shadow-lg shadow-primary-container/20 disabled:opacity-50"
              >
                <Save size={18} />
                {isSaving ? 'Enregistrement...' : 'Enregistrer le Budget'}
              </button>

              <div className="pt-4 border-t border-outline-variant space-y-3">
                {!hasToken ? (
                  <button 
                    onClick={handleConnect}
                    className="w-full bg-white border border-outline-variant text-on-surface py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-surface transition-all"
                  >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
                    Connecter Google Calendar
                  </button>
                ) : (
                  <button 
                    onClick={handleSyncToCalendar}
                    disabled={isSyncing}
                    className="w-full bg-secondary/10 text-secondary border border-secondary/20 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-secondary/20 transition-all disabled:opacity-50"
                  >
                    {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />}
                    {isSyncing ? 'Synchronisation...' : 'Synchroniser au Calendrier'}
                  </button>
                )}
                <p className="text-[9px] text-on-surface-variant text-center opacity-60">
                  Crée des événements pour le 1er du mois sélectionné.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Section */}
        <div className="lg:col-span-8 w-full lg:w-2/3 space-y-8">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Revenue Tracker */}
              <div className="bg-white rounded-[40px] border border-outline-variant p-8 shadow-sm space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">Revenus vs Objectif</p>
                    <h3 className="font-display font-bold text-2xl">Suivi Revenus</h3>
                  </div>
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                    <TrendingUp size={24} />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-3xl font-display font-bold">{formatCurrency(actuals.income)}</span>
                    <span className="text-xs text-on-surface-variant font-medium">sur {formatCurrency(parseFloat(targetRevenue) || 0)}</span>
                  </div>
                  <div className="h-4 bg-background rounded-full overflow-hidden border border-outline-variant">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(revenueProgress, 100)}%` }}
                      className={cn(
                        "h-full rounded-full transition-all",
                        revenueProgress >= 100 ? "bg-emerald-500" : "bg-emerald-400"
                      )}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span>{revenueProgress.toFixed(1)}% de l'objectif</span>
                    {revenueProgress >= 100 ? (
                      <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12} /> Objectif Atteint</span>
                    ) : (
                      <span className="text-on-surface-variant">Reste {formatCurrency(Math.max(0, (parseFloat(targetRevenue) || 0) - actuals.income))}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Expense Tracker */}
              <div className="bg-white rounded-[40px] border border-outline-variant p-8 shadow-sm space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-red-600 mb-1">Dépenses vs Limite</p>
                    <h3 className="font-display font-bold text-2xl">Suivi Dépenses</h3>
                  </div>
                  <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
                    <TrendingDown size={24} />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-3xl font-display font-bold">{formatCurrency(actuals.expense)}</span>
                    <span className="text-xs text-on-surface-variant font-medium">limite: {formatCurrency(parseFloat(expenseLimit) || 0)}</span>
                  </div>
                  <div className="h-4 bg-background rounded-full overflow-hidden border border-outline-variant">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(expenseProgress, 100)}%` }}
                      className={cn(
                        "h-full rounded-full transition-all",
                        expenseProgress > 100 ? "bg-red-500" : expenseProgress > 80 ? "bg-amber-500" : "bg-primary-container"
                      )}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span>{expenseProgress.toFixed(1)}% de la limite</span>
                    {expenseProgress > 100 ? (
                      <span className="text-red-600 flex items-center gap-1 font-black"><AlertCircle size={12} /> LIMITE DÉPASSÉE</span>
                    ) : (
                      <span className="text-on-surface-variant">Marge {formatCurrency(Math.max(0, (parseFloat(expenseLimit) || 0) - actuals.expense))}</span>
                    )}
                  </div>
                </div>
              </div>
           </div>

           {/* Forecast / Insights Card */}
           <div className="bg-secondary p-10 rounded-[40px] text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32 blur-3xl"></div>
             <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                <div className="space-y-4">
                  <h3 className="font-display text-2xl font-bold">Analyse du Budget</h3>
                  <p className="text-white/70 text-sm leading-relaxed">
                    Sur la base de vos dépenses actuelles de {formatCurrency(actuals.expense)} et de votre objectif de {formatCurrency(parseFloat(targetRevenue) || 0)}, 
                    votre bénéfice prévisionnel pour {selectedMonth} est de <span className="font-bold text-white underline decoration-white/30 underline-offset-4">{formatCurrency(actuals.income - actuals.expense)}</span>.
                  </p>
                  <div className="flex items-center gap-4 pt-4">
                    <div className="flex -space-x-2">
                       {[1,2,3].map(i => (
                         <div key={i} className="w-8 h-8 rounded-full border-2 border-secondary bg-white/20 flex items-center justify-center text-[10px] font-bold">AI</div>
                       ))}
                    </div>
                    <p className="text-[10px] uppercase font-bold tracking-widest opacity-60">Prévisions boostées par vos données historiques</p>
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-3xl space-y-4">
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="text-amber-300" size={20} />
                    <span className="text-xs font-bold uppercase tracking-widest">Conseil Budgétaire</span>
                  </div>
                  <p className="text-xs italic opacity-90">
                    {expenseProgress > 90 
                      ? "Attention, vous approchez de votre limite de dépenses. Envisagez de reporter les achats non essentiels au mois prochain."
                      : actuals.income > (parseFloat(targetRevenue) || 0) 
                        ? "Félicitations ! Votre revenu a déjà dépassé l'objectif mensuel. Pensez à réinvestir l'excédent."
                        : "Planifiez vos dépenses de manière stratégique pour maximiser votre bénéfice net d'ici la fin du mois."}
                  </p>
                </div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
