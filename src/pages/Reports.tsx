import { useState, useMemo } from 'react';
import { useCompany } from '../context/CompanyContext';
import { CATEGORIES, MONTHS, YEARS } from '../constants';
import { formatCurrency, downloadCSV, cn } from '../lib/utils';
import { FileText, Download, Calendar, Filter, ChevronRight, TrendingUp, TrendingDown, Clock, Search, Scale, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { format, isWithinInterval, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Reports() {
  const { selectedCompany, revenues, detailedEntries, loading } = useCompany();
  
  // States
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [entryType, setEntryType] = useState<'all' | 'revenue' | 'expense'>('all');
  const [searchQuery, setSearchQuery] = useState('');

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
  const [compMonthA, setCompMonthA] = useState(MONTHS[new Date().getMonth()]);
  const [compYearA, setCompYearA] = useState(new Date().getFullYear().toString());
  const [compMonthB, setCompMonthB] = useState(MONTHS[new Date().getMonth()]);
  const [compYearB, setCompYearB] = useState((new Date().getFullYear() - 1).toString());

  const comparisonData = useMemo(() => {
    if (!selectedCompany) return null;

    const getDataForPeriod = (month: string, year: string) => {
      const yearNum = parseInt(year);
      
      const periodRevenues = revenues.filter(r => r.month === month && (r.createdAt?.toDate ? r.createdAt.toDate().getFullYear() === yearNum : true));
      const income = periodRevenues.reduce((sum, r) => sum + (r.revenue || 0), 0);
      
      const periodExpenses = detailedEntries.filter(e => e.month === month && e.year === yearNum);
      const expense = periodExpenses.reduce((sum, e) => sum + (e.total || 0), 0);
      
      return { income, expense, balance: income - expense };
    };

    const periodA = getDataForPeriod(compMonthA, compYearA);
    const periodB = getDataForPeriod(compMonthB, compYearB);

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
  }, [selectedCompany, revenues, detailedEntries, compMonthA, compYearA, compMonthB, compYearB]);

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
      <div className="bg-white p-6 rounded-[32px] border border-outline-variant shadow-sm flex flex-col md:flex-row gap-6 items-end">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 flex-grow w-full">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-on-surface-variant flex items-center gap-2">
              <Calendar size={12} /> Date Début
            </label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-background border border-outline-variant rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-container transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-on-surface-variant flex items-center gap-2">
              <Calendar size={12} /> Date Fin
            </label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-background border border-outline-variant rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-container transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-on-surface-variant flex items-center gap-2">
              <Filter size={12} /> Type d'entrée
            </label>
            <select 
              value={entryType}
              onChange={(e) => setEntryType(e.target.value as any)}
              className="w-full bg-background border border-outline-variant rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-container transition-colors"
            >
              <option value="all">Tout afficher</option>
              <option value="revenue">Revenus uniquement</option>
              <option value="expense">Dépenses uniquement</option>
            </select>
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
        <div className="p-8 border-b border-outline-variant bg-surface/30">
          <div className="flex items-center gap-3">
            <Scale className="text-secondary" size={24} />
            <h2 className="font-display font-bold text-xl">Outil de Comparaison Temporelle</h2>
          </div>
          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mt-1 opacity-60">Visualisez les écarts entre deux périodes distinctes</p>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-4 space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-container">Période A</h4>
                  <select 
                    value={compMonthA}
                    onChange={(e) => setCompMonthA(e.target.value)}
                    className="w-full bg-background border border-outline-variant rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-container"
                  >
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select 
                    value={compYearA}
                    onChange={(e) => setCompYearA(e.target.value)}
                    className="w-full bg-background border border-outline-variant rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-container"
                  >
                    {/* Extend years for the user request specifically (2006/2005) */}
                    {[2006, 2005, ...YEARS].filter((v, i, a) => a.indexOf(v) === i).sort((a,b) => Number(b)-Number(a)).map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">Période B</h4>
                  <select 
                    value={compMonthB}
                    onChange={(e) => setCompMonthB(e.target.value)}
                    className="w-full bg-background border border-outline-variant rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-container"
                  >
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select 
                    value={compYearB}
                    onChange={(e) => setCompYearB(e.target.value)}
                    className="w-full bg-background border border-outline-variant rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-container"
                  >
                    {[2006, 2005, ...YEARS].filter((v, i, a) => a.indexOf(v) === i).sort((a,b) => Number(b)-Number(a)).map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
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

            <div className="lg:col-span-8 h-[400px]">
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
                    <Bar name={`${compMonthA} ${compYearA}`} dataKey="A" fill="var(--color-primary-container)" radius={[8, 8, 0, 0]} barSize={40} />
                    <Bar name={`${compMonthB} ${compYearB}`} dataKey="B" fill="var(--color-secondary)" radius={[8, 8, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-on-surface-variant opacity-40 font-bold uppercase tracking-widest">
                  Données indisponibles
                </div>
              )}
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
