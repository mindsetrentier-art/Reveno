import { useState, useMemo } from 'react';
import { useCompany } from '../context/CompanyContext';
import { CATEGORIES, MONTHS, YEARS } from '../constants';
import { formatCurrency, downloadCSV, cn } from '../lib/utils';
import { FileText, Download, Calendar, Filter, ChevronRight, TrendingUp, TrendingDown, Clock, Search, Scale, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { format, isWithinInterval, parseISO, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, startOfDay, endOfDay, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

export default function Reports() {
  const { selectedCompany, revenues, detailedEntries, loading } = useCompany();
  
  // States
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [entryType, setEntryType] = useState<'all' | 'revenue' | 'expense'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const presets = [
    { label: 'Ce Mois', getRange: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }) },
    { label: 'Dernier Mois', getRange: () => {
      const lastMonth = subMonths(new Date(), 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    }},
    { label: 'Derniers 3 Mois', getRange: () => ({ start: startOfMonth(subMonths(new Date(), 3)), end: endOfMonth(new Date()) }) },
    { label: 'Cette Année', getRange: () => ({ start: startOfYear(new Date()), end: endOfYear(new Date()) }) },
    { label: 'Tout le temps', getRange: () => ({ start: new Date(2000, 0, 1), end: new Date(2100, 11, 31) }) },
  ];

  const handlePresetClick = (preset: typeof presets[0]) => {
    const range = preset.getRange();
    setStartDate(format(range.start, 'yyyy-MM-dd'));
    setEndDate(format(range.end, 'yyyy-MM-dd'));
    setShowDatePicker(false);
  };

  // Filtering Logic
  const filteredData = useMemo(() => {
    if (!selectedCompany) return { combined: [] as any[], summary: { income: 0, expense: 0, balance: 0 }, categoryBreakdown: {} as Record<string, number> };

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Process Revenues
    const filteredRevenues = (revenues || []).filter(rev => {
      const revMonthIdx = MONTHS.indexOf(rev.month);
      const revYear = new Date().getFullYear(); 
      const revDate = new Date(revYear, revMonthIdx, 15);
      
      return isWithinInterval(revDate, { start, end });
    }).map(r => ({ 
      ...r, 
      type: 'INCOME', 
      label: `Revenu - ${r.month}`,
      date: new Date(new Date().getFullYear(), MONTHS.indexOf(r.month), 15) // for sorting
    }));

    // Process Detailed Entries
    const filteredExpenses = (detailedEntries || []).filter(entry => {
      const entryDate = entry.date;
      return isWithinInterval(entryDate, { start, end });
    }).map(e => ({ ...e, type: 'EXPENSE', label: 'Saisie Détaillée' }));

    const combined = [...filteredRevenues, ...filteredExpenses]
      .filter(item => {
        if (entryType === 'revenue') return item.type === 'INCOME';
        if (entryType === 'expense') return item.type === 'EXPENSE';
        return true;
      })
      .sort((a, b) => {
        const dateA = a.date || new Date();
        const dateB = b.date || new Date();
        return dateB.getTime() - dateA.getTime();
      });

    // Calculations
    let income = 0;
    let expense = 0;
    const catBreakdown: Record<string, number> = {};

    combined.forEach(item => {
      if (item.type === 'INCOME') {
        income += (item.revenue || 0);
      } else {
        expense += (item.total || 0);
        Object.entries(item.breakdown || {}).forEach(([catId, amt]) => {
          catBreakdown[catId] = (catBreakdown[catId] || 0) + (amt as number);
        });
      }
    });

    return {
      combined,
      summary: { income, expense, balance: income - expense },
      categoryBreakdown: catBreakdown
    };
  }, [selectedCompany, revenues, detailedEntries, startDate, endDate, entryType]);

  const handleExport = () => {
    const csvData = filteredData.combined.map(item => ({
      Date: item.date ? format(item.date, 'yyyy-MM-dd') : 'N/A',
      Type: item.type === 'INCOME' ? 'Revenu' : 'Dépense',
      Libellé: item.label,
      Montant: item.type === 'INCOME' ? item.revenue : item.total
    }));
    downloadCSV(csvData, `Rapport_${selectedCompany?.name}_${startDate}_${endDate}.csv`);
  };

  // Comparison States
  const [compMode, setCompMode] = useState<'monthly' | 'custom'>('monthly');
  const [compMonthA, setCompMonthA] = useState(MONTHS[new Date().getMonth()]);
  const [compYearA, setCompYearA] = useState(new Date().getFullYear().toString());
  const [compMonthB, setCompMonthB] = useState(MONTHS[new Date().getMonth()]);
  const [compYearB, setCompYearB] = useState((new Date().getFullYear() - 1).toString());

  const [compStartDateA, setCompStartDateA] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [compEndDateA, setCompEndDateA] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [compStartDateB, setCompStartDateB] = useState(format(startOfMonth(new Date(new Date().setFullYear(new Date().getFullYear() - 1))), 'yyyy-MM-dd'));
  const [compEndDateB, setCompEndDateB] = useState(format(endOfMonth(new Date(new Date().setFullYear(new Date().getFullYear() - 1))), 'yyyy-MM-dd'));

  const calculateStatsForRange = (start: Date, end: Date) => {
    // Process Revenues
    const periodRevenues = (revenues || []).filter(rev => {
      const revMonthIdx = MONTHS.indexOf(rev.month);
      let revYear = new Date().getFullYear();
      if (rev.createdAt) {
        const d = rev.createdAt.toDate ? rev.createdAt.toDate() : new Date(rev.createdAt);
        revYear = d.getFullYear();
      }
      const revDate = new Date(revYear, revMonthIdx, 15);
      return isWithinInterval(revDate, { start, end });
    });
    const income = periodRevenues.reduce((sum, r) => sum + (r.revenue || 0), 0);

    // Process Expenses
    const periodExpenses = (detailedEntries || []).filter(entry => {
      return isWithinInterval(entry.date, { start, end });
    });
    const expense = periodExpenses.reduce((sum, e) => sum + (e.total || 0), 0);

    return { income, expense, balance: income - expense };
  };

  const comparisonData = useMemo(() => {
    if (!selectedCompany) return null;

    let startA: Date, endA: Date, startB: Date, endB: Date;

    if (compMode === 'monthly') {
      const yearA = parseInt(compYearA);
      const monthIdxA = MONTHS.indexOf(compMonthA);
      startA = startOfMonth(new Date(yearA, monthIdxA, 1));
      endA = endOfMonth(new Date(yearA, monthIdxA, 1));

      const yearB = parseInt(compYearB);
      const monthIdxB = MONTHS.indexOf(compMonthB);
      startB = startOfMonth(new Date(yearB, monthIdxB, 1));
      endB = endOfMonth(new Date(yearB, monthIdxB, 1));
    } else {
      startA = new Date(compStartDateA);
      endA = new Date(compEndDateA);
      startB = new Date(compStartDateB);
      endB = new Date(compEndDateB);
    }

    const periodA = calculateStatsForRange(startA, endA);
    const periodB = calculateStatsForRange(startB, endB);

    // Calculate Category Breakdown for Expenses in both periods
    const getCatBreakdown = (start: Date, end: Date) => {
      const breakdown: Record<string, number> = {};
      (detailedEntries || []).filter(e => isWithinInterval(e.date, { start, end })).forEach(e => {
        Object.entries(e.breakdown || {}).forEach(([catId, amt]) => {
          breakdown[catId] = (breakdown[catId] || 0) + (amt as number);
        });
      });
      return breakdown;
    };

    const catBreakdownA = getCatBreakdown(startA, endA);
    const catBreakdownB = getCatBreakdown(startB, endB);

    // Prepare chart data for category comparison
    const categoryChartData = CATEGORIES.map(cat => ({
      name: cat.label,
      A: catBreakdownA[cat.id] || 0,
      B: catBreakdownB[cat.id] || 0
    })).filter(item => item.A > 0 || item.B > 0);

    const diffIncome = periodA.income - periodB.income;
    const diffExpense = periodA.expense - periodB.expense;
    const diffBalance = periodA.balance - periodB.balance;

    const getPct = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      periodA,
      periodB,
      catBreakdownA,
      catBreakdownB,
      categoryChartData,
      diff: {
        income: diffIncome,
        expense: diffExpense,
        balance: diffBalance,
        incomePct: getPct(periodA.income, periodB.income),
        expensePct: getPct(periodA.expense, periodB.expense),
        balancePct: getPct(periodA.balance, periodB.balance)
      },
      chartData: [
        { name: 'Revenus', A: periodA.income, B: periodB.income },
        { name: 'Dépenses', A: periodA.expense, B: periodB.expense },
        { name: 'Bénéfice', A: periodA.balance, B: periodB.balance }
      ]
    };
  }, [selectedCompany, revenues, detailedEntries, compMode, compMonthA, compYearA, compMonthB, compYearB, compStartDateA, compEndDateA, compStartDateB, compEndDateB]);

  const setQuarterPreset = (period: 'A' | 'B', quarter: 1 | 2 | 3 | 4, year: number) => {
    const startMonth = (quarter - 1) * 3;
    const start = format(new Date(year, startMonth, 1), 'yyyy-MM-dd');
    const end = format(endOfMonth(new Date(year, startMonth + 2, 1)), 'yyyy-MM-dd');
    
    if (period === 'A') {
      setCompStartDateA(start);
      setCompEndDateA(end);
    } else {
      setCompStartDateB(start);
      setCompEndDateB(end);
    }
    setCompMode('custom');
  };

  const handleComparisonExport = () => {
    if (!comparisonData) return;
    const labelA = compMode === 'monthly' ? `${compMonthA} ${compYearA}` : 'Période A';
    const labelB = compMode === 'monthly' ? `${compMonthB} ${compYearB}` : 'Période B';
    
    const csvData = [
      { Métrique: 'Revenus', [labelA]: comparisonData.periodA.income, [labelB]: comparisonData.periodB.income, Delta: comparisonData.diff.income },
      { Métrique: 'Dépenses', [labelA]: comparisonData.periodA.expense, [labelB]: comparisonData.periodB.expense, Delta: comparisonData.diff.expense },
      { Métrique: 'Bénéfice', [labelA]: comparisonData.periodA.balance, [labelB]: comparisonData.periodB.balance, Delta: comparisonData.diff.balance },
      ...comparisonData.categoryChartData.map(c => ({
        Métrique: `Cat: ${c.name}`,
        [labelA]: c.A,
        [labelB]: c.B,
        Delta: c.A - c.B
      }))
    ];
    downloadCSV(csvData, `Comparaison_${selectedCompany?.name}.csv`);
    alert('Comparaison exportée avec succès !');
  };

  if (loading) return <div className="p-20 text-center font-bold text-on-surface-variant animate-pulse tracking-widest uppercase">Génération du rapport...</div>;

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-secondary font-bold text-[10px] uppercase tracking-[0.2em]">
            <FileText size={14} />
            <span>Analyses & Statistiques</span>
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl">Rapports Personnalisés</h1>
        </div>
        <button 
          onClick={handleExport}
          className="flex items-center gap-3 bg-white border border-outline-variant px-6 py-3 rounded-2xl font-bold hover:bg-surface active:scale-95 transition-all shadow-sm"
        >
          <Download size={20} />
          <span>Exporter CSV</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-6 rounded-[32px] border border-outline-variant shadow-sm flex flex-col gap-6">
        <div className="flex flex-wrap gap-2">
          {presets.map(preset => (
            <button
              key={preset.label}
              onClick={() => handlePresetClick(preset)}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                startDate === format(preset.getRange().start, 'yyyy-MM-dd') && endDate === format(preset.getRange().end, 'yyyy-MM-dd')
                  ? "bg-primary-container text-white border-primary-container"
                  : "bg-surface border-outline-variant text-on-surface-variant hover:bg-outline-variant/10"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
          <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              <label className="text-[10px] font-bold uppercase text-on-surface-variant flex items-center gap-2 mb-2">
                <Calendar size={12} /> Période Personnalisée
              </label>
              <div 
                className="flex items-center gap-2 bg-background border border-outline-variant rounded-xl px-4 py-2.5 text-sm cursor-pointer hover:border-primary-container transition-colors"
                onClick={() => setShowDatePicker(!showDatePicker)}
              >
                <span className="font-medium">{format(new Date(startDate), 'dd MMM yyyy', { locale: fr })}</span>
                <ArrowRight size={14} className="text-on-surface-variant/40" />
                <span className="font-medium">{format(new Date(endDate), 'dd MMM yyyy', { locale: fr })}</span>
              </div>
              
              <AnimatePresence>
                {showDatePicker && (
                  <>
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-40 bg-black/5"
                      onClick={() => setShowDatePicker(false)}
                    />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute top-full left-0 mt-2 z-50 bg-white border border-outline-variant rounded-3xl shadow-2xl p-4"
                    >
                      <DayPicker
                        mode="range"
                        selected={{
                          from: new Date(startDate),
                          to: new Date(endDate)
                        }}
                        onSelect={(range) => {
                          if (range?.from) setStartDate(format(range.from, 'yyyy-MM-dd'));
                          if (range?.to) setEndDate(format(range.to, 'yyyy-MM-dd'));
                        }}
                        locale={fr}
                        className="m-0"
                        classNames={{
                          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                          month: "space-y-4",
                          month_caption: "flex justify-center pt-1 relative items-center",
                          caption_label: "text-sm font-bold text-primary-container px-8",
                          nav: "space-x-1 flex items-center",
                          button_previous: "absolute left-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 transition-opacity",
                          button_next: "absolute right-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 transition-opacity",
                          month_grid: "w-full border-collapse space-y-1",
                          weekdays: "flex",
                          weekday: "text-on-surface-variant rounded-md w-9 font-bold text-[10px] uppercase tracking-widest text-center",
                          week: "flex w-full mt-2",
                          day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-surface rounded-xl transition-all flex items-center justify-center cursor-pointer",
                          range_end: "day-range-end",
                          selected: "bg-primary-container text-white hover:bg-primary-container hover:text-white focus:bg-primary-container focus:text-white rounded-xl font-bold",
                          today: "bg-surface text-primary-container font-black",
                          outside: "text-on-surface-variant opacity-50",
                          disabled: "text-on-surface-variant opacity-50",
                          range_middle: "aria-selected:bg-primary-container/10 aria-selected:text-primary-container rounded-none",
                          hidden: "invisible",
                        }}
                      />
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-on-surface-variant flex items-center gap-2">
                <Filter size={12} /> Type d'entrée
              </label>
              <select 
                value={entryType}
                onChange={(e) => setEntryType(e.target.value as any)}
                className="w-full h-[45px] bg-background border border-outline-variant rounded-xl px-4 text-sm outline-none focus:border-primary-container transition-colors font-medium"
              >
                <option value="all">Tout afficher</option>
                <option value="revenue">Revenus uniquement</option>
                <option value="expense">Dépenses uniquement</option>
              </select>
            </div>
          </div>
          
          <div className="md:col-span-4 flex justify-end">
             <div className="bg-surface/50 border border-outline-variant rounded-2xl px-4 py-2 flex items-center gap-4 w-full justify-between">
                <div>
                   <p className="text-[9px] font-bold uppercase text-on-surface-variant opacity-60">Période active</p>
                   <p className="text-[10px] font-black uppercase text-primary-container">
                     {format(new Date(startDate), 'MMM yy', { locale: fr })} - {format(new Date(endDate), 'MMM yy', { locale: fr })}
                   </p>
                </div>
                <div className="h-8 w-px bg-outline-variant" />
                <div className="text-right">
                   <p className="text-[9px] font-bold uppercase text-on-surface-variant opacity-60">Total</p>
                   <p className="text-xs font-bold text-on-surface">
                     {filteredData.combined.length} entrées
                   </p>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[32px]">
          <div className="flex items-center gap-3 text-emerald-600 mb-4">
            <TrendingUp size={20} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Revenus Totaux</span>
          </div>
          <div className="text-3xl font-display font-bold text-emerald-900">
            {formatCurrency(filteredData.summary.income)}
          </div>
        </div>
        <div className="bg-red-50 border border-red-100 p-6 rounded-[32px]">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <TrendingDown size={20} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Dépenses Totales</span>
          </div>
          <div className="text-3xl font-display font-bold text-red-900">
            {formatCurrency(filteredData.summary.expense)}
          </div>
        </div>
        <div className="bg-primary-container/5 border border-primary-container/10 p-6 rounded-[32px]">
          <div className="flex items-center gap-3 text-primary-container mb-4">
            <TrendingUp size={20} className={filteredData.summary.balance < 0 ? 'rotate-180 text-red-500' : ''} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Bénéfice Net</span>
          </div>
          <div className={cn(
            "text-3xl font-display font-bold",
            filteredData.summary.balance < 0 ? 'text-red-700' : 'text-on-surface'
          )}>
            {formatCurrency(filteredData.summary.balance)}
          </div>
        </div>
      </div>

      {/* Comparison Tool Section */}
      <div className="bg-white rounded-[40px] border border-outline-variant shadow-sm overflow-hidden mb-8">
        <div className="p-8 border-b border-outline-variant bg-surface/30 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3">
              <Scale className="text-secondary" size={24} />
              <h2 className="font-display font-bold text-xl">Outil de Comparaison Temporelle</h2>
            </div>
            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mt-1 opacity-60">Visualisez les écarts entre deux périodes distinctes</p>
          </div>
          {comparisonData && (
            <button 
              onClick={handleComparisonExport}
              className="flex items-center gap-2 px-6 py-2 bg-white border border-outline-variant rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-surface transition-all shadow-sm"
            >
              <Download size={16} />
              Exporter Comparaison
            </button>
          )}
        </div>

        <div className="p-8">
          <div className="flex bg-surface p-1 rounded-2xl border border-outline-variant w-fit mb-8">
            <button 
              onClick={() => setCompMode('monthly')}
              className={cn(
                "px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                compMode === 'monthly' ? "bg-white shadow-sm text-primary-container" : "text-on-surface-variant hover:bg-white/50"
              )}
            >
              Mensuel
            </button>
            <button 
              onClick={() => setCompMode('custom')}
              className={cn(
                "px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                compMode === 'custom' ? "bg-white shadow-sm text-primary-container" : "text-on-surface-variant hover:bg-white/50"
              )}
            >
              Personnalisé / T1, T2...
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-4 space-y-8">
              <div className="grid grid-cols-2 gap-8">
                {/* Period A Selection */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-container">Période A</h4>
                  {compMode === 'monthly' ? (
                    <div className="space-y-3">
                      <select 
                        value={compMonthA}
                        onChange={(e) => setCompMonthA(e.target.value)}
                        className="w-full bg-background border border-outline-variant rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-container font-medium"
                      >
                        {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <select 
                        value={compYearA}
                        onChange={(e) => setCompYearA(e.target.value)}
                        className="w-full bg-background border border-outline-variant rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-container font-medium"
                      >
                        {[2006, 2005, ...YEARS].filter((v, i, a) => a.indexOf(v) === i).sort((a,b) => Number(b)-Number(a)).map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <input 
                          type="date" 
                          value={compStartDateA}
                          onChange={(e) => setCompStartDateA(e.target.value)}
                          className="w-full bg-background border border-outline-variant rounded-xl px-4 py-2.5 text-xs font-medium"
                        />
                        <input 
                          type="date" 
                          value={compEndDateA}
                          onChange={(e) => setCompEndDateA(e.target.value)}
                          className="w-full bg-background border border-outline-variant rounded-xl px-4 py-2.5 text-xs font-medium"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[1, 2, 3, 4].map(q => (
                          <button 
                            key={q}
                            onClick={() => setQuarterPreset('A', q as any, parseInt(compYearA))}
                            className="py-2 bg-surface hover:bg-primary-container/10 border border-outline-variant rounded-lg text-[9px] font-bold uppercase tracking-tighter transition-all"
                          >
                            T{q} {compYearA}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Period B Selection */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">Période B</h4>
                  {compMode === 'monthly' ? (
                    <div className="space-y-3">
                      <select 
                        value={compMonthB}
                        onChange={(e) => setCompMonthB(e.target.value)}
                        className="w-full bg-background border border-outline-variant rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-container font-medium"
                      >
                        {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <select 
                        value={compYearB}
                        onChange={(e) => setCompYearB(e.target.value)}
                        className="w-full bg-background border border-outline-variant rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-container font-medium"
                      >
                        {[2006, 2005, ...YEARS].filter((v, i, a) => a.indexOf(v) === i).sort((a,b) => Number(b)-Number(a)).map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <input 
                          type="date" 
                          value={compStartDateB}
                          onChange={(e) => setCompStartDateB(e.target.value)}
                          className="w-full bg-background border border-outline-variant rounded-xl px-4 py-2.5 text-xs font-medium"
                        />
                        <input 
                          type="date" 
                          value={compEndDateB}
                          onChange={(e) => setCompEndDateB(e.target.value)}
                          className="w-full bg-background border border-outline-variant rounded-xl px-4 py-2.5 text-xs font-medium"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[1, 2, 3, 4].map(q => (
                          <button 
                            key={q}
                            onClick={() => setQuarterPreset('B', q as any, parseInt(compYearB))}
                            className="py-2 bg-surface hover:bg-secondary/10 border border-outline-variant rounded-lg text-[9px] font-bold uppercase tracking-tighter transition-all"
                          >
                            T{q} {compYearB}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {comparisonData && (
                <div className="space-y-6 pt-6 border-t border-outline-variant">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Delta Revenus</span>
                    <span className={cn(
                      "font-display font-bold text-lg",
                      comparisonData.diff.income >= 0 ? "text-emerald-600" : "text-red-600"
                    )}>
                      {comparisonData.diff.income >= 0 ? '+' : ''}{formatCurrency(comparisonData.diff.income)}
                      <span className="text-[10px] ml-2">({comparisonData.diff.incomePct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Delta Dépenses</span>
                    <span className={cn(
                      "font-display font-bold text-lg",
                      comparisonData.diff.expense <= 0 ? "text-emerald-600" : "text-red-600"
                    )}>
                      {comparisonData.diff.expense >= 0 ? '+' : ''}{formatCurrency(comparisonData.diff.expense)}
                      <span className="text-[10px] ml-2">({comparisonData.diff.expensePct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Delta Bénéfice</span>
                    <span className={cn(
                      "font-display font-bold text-lg",
                      comparisonData.diff.balance >= 0 ? "text-emerald-600" : "text-red-600"
                    )}>
                      {comparisonData.diff.balance >= 0 ? '+' : ''}{formatCurrency(comparisonData.diff.balance)}
                      <span className="text-[10px] ml-2">({comparisonData.diff.balancePct.toFixed(1)}%)</span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-8 flex flex-col gap-12">
               <div className="h-[300px]">
                {comparisonData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData.chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-variant)" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 11, fontWeight: 600 }}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 10 }}
                        tickFormatter={(value) => `${value}€`}
                      />
                      <Tooltip 
                        cursor={{ fill: 'var(--color-surface)', opacity: 0.4 }}
                        contentStyle={{ 
                          backgroundColor: 'var(--color-surface)', 
                          border: '1px solid var(--color-outline-variant)', 
                          borderRadius: '16px',
                          fontWeight: 'bold'
                        }}
                      />
                      <Legend iconType="circle" />
                      <Bar 
                        name={compMode === 'monthly' ? `${compMonthA} ${compYearA}` : 'Période A'} 
                        dataKey="A" 
                        fill="var(--color-primary-container)" 
                        radius={[8, 8, 0, 0]} 
                        barSize={40} 
                      />
                      <Bar 
                        name={compMode === 'monthly' ? `${compMonthB} ${compYearB}` : 'Période B'} 
                        dataKey="B" 
                        fill="var(--color-secondary)" 
                        radius={[8, 8, 0, 0]} 
                        barSize={40} 
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-on-surface-variant opacity-40 font-bold uppercase tracking-widest">
                    Données indisponibles
                  </div>
                )}
               </div>

               {/* Category Comparison chart */}
               <div className="h-[350px]">
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 text-center">Comparatif des dépenses par catégorie</h4>
                  {comparisonData && comparisonData.categoryChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={comparisonData.categoryChartData} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-outline-variant)" />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700 }} />
                        <Tooltip 
                         contentStyle={{ borderRadius: '12px' }}
                        />
                        <Legend iconType="circle" />
                        <Bar name="Période A" dataKey="A" fill="var(--color-primary-container)" radius={[0, 4, 4, 0]} />
                        <Bar name="Période B" dataKey="B" fill="var(--color-secondary)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-on-surface-variant opacity-20 text-[10px] font-bold uppercase tracking-widest">
                      Aucune dépense par catégorie à comparer
                    </div>
                  )}
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Transaction History */}
        <div className="lg:col-span-8 bg-white rounded-[40px] border border-outline-variant shadow-sm overflow-hidden h-fit">
          <div className="p-8 border-b border-outline-variant">
            <h2 className="font-display font-bold text-xl">Détail des transactions</h2>
          </div>
          <div className="divide-y divide-outline-variant">
            {filteredData.combined.length === 0 ? (
              <div className="p-20 text-center text-on-surface-variant opacity-50 italic">
                Aucune donnée correspondant à ces critères.
              </div>
            ) : (
              filteredData.combined.map((item, idx) => (
                <div key={idx} className="p-6 flex justify-between items-center hover:bg-background transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      item.type === 'INCOME' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                    )}>
                      {item.type === 'INCOME' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                    </div>
                    <div>
                      <div className="font-bold text-sm">{item.label}</div>
                      <div className="text-[10px] text-on-surface-variant flex items-center gap-1">
                        <Clock size={10} />
                        {item.date ? format(item.date, 'dd MMM yyyy', { locale: fr }) : 'Période non spécifiée'}
                      </div>
                    </div>
                  </div>
                  <div className={cn(
                    "font-display font-bold text-lg",
                    item.type === 'INCOME' ? 'text-emerald-600' : 'text-on-surface'
                  )}>
                    {item.type === 'INCOME' ? '+' : '-'}{formatCurrency(item.type === 'INCOME' ? item.revenue : item.total)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Category breakdown summary */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-8 rounded-[40px] border border-outline-variant shadow-sm">
            <h3 className="font-display font-bold text-xl mb-6">Répartition Dépenses</h3>
            <div className="space-y-4">
              {(Object.entries(filteredData.categoryBreakdown) as [string, number][])
                .sort((a, b) => b[1] - a[1])
                .map(([catId, amount]) => {
                  const cat = CATEGORIES.find(c => c.id === catId);
                  const percentage = (amount / (filteredData.summary.expense || 1)) * 100;
                  return (
                    <div key={catId} className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-tight">
                        <span className="truncate pr-2">{cat?.label || catId}</span>
                        <span>{formatCurrency(amount as number)}</span>
                      </div>
                      <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: cat?.color || '#ccc' }}
                        />
                      </div>
                    </div>
                  );
                })}
              {Object.keys(filteredData.categoryBreakdown).length === 0 && (
                <div className="text-center py-10 text-on-surface-variant opacity-40 text-xs italic">
                  Aucune dépense catégorisée
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
