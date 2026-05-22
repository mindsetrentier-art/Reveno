import { useRevenueData, useGoalData } from '../hooks/useFinance';
import { formatCurrency, downloadCSV, cn } from '../lib/utils';
import { exportToPDF } from '../lib/pdfExport';
import { TrendingUp, Target, CreditCard, ArrowUpRight, Edit2, Check, X, Wallet } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { useCompany } from '../context/CompanyContext';
import { useState, useMemo } from 'react';
import WeatherWidget from '../components/WeatherWidget';
import { CATEGORIES, MONTHS, YEARS } from '../constants';

export default function Dashboard() {
  const { selectedCompany, revenues, detailedEntries, goal, loading: contextLoading, updateGoal } = useCompany();
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [newGoalValue, setNewGoalValue] = useState('');

  // Expense Chart States
  const [expenseMonth, setExpenseMonth] = useState<string>('all');
  const [expenseYear, setExpenseYear] = useState<string>(new Date().getFullYear().toString());

  // Cash Flow Range State
  const [cashFlowRange, setCashFlowRange] = useState<number>(6);

  const expenseBreakdown = useMemo(() => {
    const totals: Record<string, number> = {};
    
    detailedEntries.forEach(entry => {
      const matchesYear = expenseYear === 'all' || entry.year.toString() === expenseYear;
      const matchesMonth = expenseMonth === 'all' || entry.month === expenseMonth;
      
      if (matchesYear && matchesMonth) {
        Object.entries(entry.breakdown).forEach(([catId, amount]) => {
          totals[catId] = (totals[catId] || 0) + (amount as number);
        });
      }
    });

    return CATEGORIES.map(cat => ({
      name: cat.label,
      value: totals[cat.id] || 0,
      color: cat.color
    })).filter(item => item.value > 0);
  }, [detailedEntries, expenseMonth, expenseYear]);

  const cashFlowData = useMemo(() => {
    // Map last N revenues to their corresponding expenses
    return [...revenues].slice(0, cashFlowRange).reverse().map(r => {
      const revYear = r.createdAt?.toDate ? r.createdAt.toDate().getFullYear() : new Date().getFullYear();
      
      const monthlyTotalExpense = detailedEntries
        .filter(e => e.month === r.month && (!e.year || e.year === revYear))
        .reduce((sum, e) => sum + (e.total || 0), 0);

      return {
        name: r.month.substring(0, 3).toUpperCase(),
        revenue: r.revenue,
        expenses: monthlyTotalExpense,
        cashFlow: r.revenue - monthlyTotalExpense,
      };
    });
  }, [revenues, detailedEntries, cashFlowRange]);

  const annualGrowthData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;

    const currentYearRevenues = new Array(12).fill(0);
    const lastYearRevenues = new Array(12).fill(0);

    revenues.forEach(r => {
      const year = r.createdAt?.toDate ? r.createdAt.toDate().getFullYear() : currentYear;
      const monthIndex = MONTHS.indexOf(r.month);
      if (monthIndex !== -1) {
        if (year === currentYear) {
          currentYearRevenues[monthIndex] += r.revenue;
        } else if (year === lastYear) {
          lastYearRevenues[monthIndex] += r.revenue;
        }
      }
    });

    return MONTHS.map((month, index) => ({
      name: month.substring(0, 3).toUpperCase(),
      currentYear: currentYearRevenues[index],
      lastYear: lastYearRevenues[index]
    }));
  }, [revenues]);

  const handleExport = () => {
    if (revenues.length === 0) return;
    
    const exportData = revenues.map(r => ({
      'Mois': r.month,
      'Revenu': r.revenue,
      'Statut': 'Confirmé',
      'Entité': selectedCompany?.name || 'Reveno'
    }));
    
    downloadCSV(exportData, `${selectedCompany?.name || 'Reveno'}_Apercu_Tresorerie.csv`);
  };

  const totalRevenue = revenues.reduce((acc, curr) => acc + curr.revenue, 0);
  const avgMonthly = revenues.length > 0 ? totalRevenue / revenues.length : 0;
  const progressToGoal = goal ? (avgMonthly / goal.monthlyGoal) * 100 : 0;

  // Chart data (take last 6 months and reverse to be chronological)
  const chartData = [...revenues].slice(0, 6).reverse().map(r => ({
    name: r.month.substring(0, 3).toUpperCase(),
    revenue: r.revenue,
    original: r
  }));

  if (contextLoading) {
    return <div className="animate-pulse space-y-8">
      <div className="h-32 bg-surface rounded-3xl"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="h-40 bg-surface rounded-3xl"></div>
        <div className="h-40 bg-surface rounded-3xl"></div>
        <div className="h-40 bg-surface rounded-3xl"></div>
      </div>
    </div>;
  }

  return (
    <div id="dashboard-report-content" className="space-y-8 bg-background pb-10">
      {/* Welcome Section */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <p className="text-secondary font-bold text-xs uppercase tracking-[0.2em] mb-2 text-center sm:text-left">Analyses Institutionnelles</p>
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-on-surface text-center sm:text-left leading-tight">Performance des Revenus</h1>
        </div>
        <div className="flex gap-2 w-full sm:w-auto" data-html2canvas-ignore>
          <button 
            onClick={() => exportToPDF('dashboard-report-content', `Dashboard_${selectedCompany?.name || 'Reveno'}`.replace(/\s+/g, '_'))}
            className="flex-1 sm:flex-none px-6 py-3 bg-white border border-outline-variant rounded-2xl text-on-surface-variant font-bold text-[10px] uppercase tracking-widest hover:bg-surface transition-colors"
          >
            Export PDF
          </button>
          <button 
            onClick={handleExport}
            className="flex-1 sm:flex-none px-6 py-3 bg-white border border-outline-variant rounded-2xl text-on-surface-variant font-bold text-[10px] uppercase tracking-widest hover:bg-surface transition-colors"
          >
            Export CSV
          </button>
        </div>
      </section>

      {/* Weather Widget Integration */}
      <div className="flex justify-end -mt-4 -mb-4">
        <WeatherWidget />
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Growth Chart */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          whileHover={{ 
            y: -4,
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.03), 0 8px 10px -6px rgba(0, 0, 0, 0.03)"
          }}
          transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.1 }}
          className="md:col-span-8 bg-white p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] shadow-sm border border-outline-variant flex flex-col min-h-[350px] sm:min-h-[400px] relative overflow-hidden"
        >
          <div className="absolute inset-0 dot-grid opacity-10 pointer-events-none"></div>
          <div className="flex flex-col sm:flex-row justify-between items-start mb-8 relative z-10 gap-4">
            <div>
              <h3 className="font-display font-bold text-2xl">Flux Mensuel</h3>
              <p className="text-on-surface-variant text-sm font-sans opacity-70">Tendances des revenus sur les 6 derniers cycles</p>
            </div>
            
            {/* Mini History Bar (Activity) */}
            <div className="w-full sm:w-auto flex flex-col items-end gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">Activité Récente</span>
              <div className="flex gap-1 h-8 items-end">
                {revenues.slice(0, 12).reverse().map((r, i) => {
                  const max = Math.max(...revenues.map(rev => rev.revenue), 1);
                  const height = (r.revenue / max) * 100;
                  return (
                    <motion.div 
                      key={r.id}
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      className="w-2.5 bg-primary-container/20 rounded-t-sm hover:bg-primary-container transition-colors"
                      title={`${r.month}: ${formatCurrency(r.revenue)}`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          
          <div className="flex-grow relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-variant)" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 10, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: 'rgba(15, 23, 42, 0.05)' }}
                  contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: '16px', fontFamily: 'Inter' }}
                />
                <Bar 
                  dataKey="revenue" 
                  radius={[8, 8, 0, 0]}
                  barSize={40}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.revenue >= (goal?.monthlyGoal || 0) ? 'var(--color-primary-container)' : 'var(--color-secondary)'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Side Stats */}
        <div className="md:col-span-4 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover="hover"
            whileTap="tap"
            variants={{
              hover: { 
                y: -8, 
                scale: 1.02,
                boxShadow: "0 25px 30px -5px rgba(0, 0, 0, 0.06), 0 10px 15px -6px rgba(0, 0, 0, 0.06)",
                borderColor: "var(--color-primary-container)"
              },
              tap: { scale: 0.98 }
            }}
            transition={{ type: "spring", stiffness: 350, damping: 22, delay: 0.2 }}
            className="bg-white p-6 sm:p-8 rounded-[28px] sm:rounded-[32px] shadow-sm border border-outline-variant space-y-4 cursor-pointer transition-colors"
          >
            <div className="flex justify-between items-center text-on-surface-variant">
              <span className="text-[10px] font-bold uppercase tracking-widest">Moyenne Mensuelle</span>
              <motion.div
                variants={{
                  hover: { rotate: 12, scale: 1.2, color: "var(--color-primary-container)" }
                }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
              >
                <CreditCard size={18} />
              </motion.div>
            </div>
            <h4 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">{formatCurrency(avgMonthly)}</h4>
            <div className="flex items-center gap-2 text-primary-container text-[10px] font-bold uppercase tracking-widest">
              <span className="bg-primary-container/10 px-2 py-0.5 rounded-full">+12.4%</span>
              <span className="opacity-60 hidden xs:inline">vs dernier exercice</span>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover="hover"
            whileTap="tap"
            variants={{
              hover: { 
                y: -8, 
                scale: 1.02,
                boxShadow: "0 25px 30px -5px rgba(0, 0, 0, 0.06), 0 10px 15px -6px rgba(0, 0, 0, 0.06)",
                borderColor: "var(--color-secondary)"
              },
              tap: { scale: 0.98 }
            }}
            transition={{ type: "spring", stiffness: 350, damping: 22, delay: 0.3 }}
            className="bg-white p-6 sm:p-8 rounded-[28px] sm:rounded-[32px] shadow-sm border border-outline-variant space-y-4 cursor-pointer transition-colors"
          >
            <div className="flex justify-between items-center text-on-surface-variant">
              <span className="text-[10px] font-bold uppercase tracking-widest">Objectif Global</span>
              <div className="flex gap-2">
                {isEditingGoal ? (
                  <>
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        const val = parseFloat(newGoalValue);
                        if (isNaN(val)) {
                          alert("Veuillez saisir un nombre valide");
                          return;
                        }
                        try {
                          await updateGoal(val);
                          setIsEditingGoal(false);
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className="p-1 hover:bg-green-50 text-green-600 rounded-md"
                    >
                      <Check size={14} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditingGoal(false);
                      }} 
                      className="p-1 hover:bg-red-50 text-red-600 rounded-md"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setNewGoalValue(goal ? (goal.monthlyGoal).toString() : '0');
                      setIsEditingGoal(true);
                    }}
                    className="p-1 hover:bg-surface rounded-md"
                  >
                    <Edit2 size={14} />
                  </button>
                )}
                <motion.div
                  variants={{
                    hover: { rotate: -12, scale: 1.2, color: "var(--color-secondary)" }
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                >
                  <Target size={18} className="text-secondary" />
                </motion.div>
              </div>
            </div>
            {isEditingGoal ? (
              <div className="flex items-end gap-2" onClick={(e) => e.stopPropagation()}>
                <div className="relative flex-grow">
                  <input 
                    autoFocus
                    type="number"
                    value={newGoalValue}
                    onChange={(e) => setNewGoalValue(e.target.value)}
                    className="w-full bg-background border border-primary-container/30 rounded-xl px-4 py-2 text-2xl font-display font-bold outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">€/mois</span>
                </div>
              </div>
            ) : (
              <h4 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">{goal ? formatCurrency(goal.monthlyGoal * 12) : '0 €'}</h4>
            )}
            <div className="space-y-4 pt-2">
              <div className="w-full bg-background border border-outline-variant h-1.5 rounded-full overflow-hidden">
                <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${Math.min(progressToGoal, 100)}%` }}
                   className="h-full bg-secondary shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                <span className="text-on-surface-variant">Progression</span>
                <span className="text-primary-container">{progressToGoal.toFixed(1)}%</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Annual Growth Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ 
             y: -4,
             boxShadow: "0 22px 30px -5px rgba(0, 0, 0, 0.04), 0 8px 12px -6px rgba(0, 0, 0, 0.04)"
          }}
          transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.1 }}
          className="lg:col-span-12 bg-white p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] shadow-sm border border-outline-variant relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 flex items-center gap-2 pointer-events-none opacity-5">
            <TrendingUp size={120} />
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 relative z-10">
            <div>
              <h3 className="font-display font-bold text-2xl">Croissance Annuelle des Revenus</h3>
              <p className="text-on-surface-variant text-sm font-sans opacity-70">Comparatif des revenus par mois, Année N vs Année N-1</p>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-primary-container"></div>
                <span>{new Date().getFullYear()}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-secondary"></div>
                <span>{new Date().getFullYear() - 1}</span>
              </div>
            </div>
          </div>

          <div className="h-[300px] sm:h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={annualGrowthData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                   <linearGradient id="colorCurrentYear" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="var(--color-primary-container)" stopOpacity={0.3}/>
                     <stop offset="95%" stopColor="var(--color-primary-container)" stopOpacity={0}/>
                   </linearGradient>
                   <linearGradient id="colorLastYear" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="var(--color-secondary)" stopOpacity={0.3}/>
                     <stop offset="95%" stopColor="var(--color-secondary)" stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-variant)" />
                 <XAxis 
                   dataKey="name" 
                   axisLine={false} 
                   tickLine={false} 
                   tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 10, fontWeight: 600 }}
                   dy={10}
                 />
                 <YAxis 
                   axisLine={false} 
                   tickLine={false}
                   tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 10 }}
                   tickFormatter={(value) => `${value > 0 ? value / 1000 + 'k' : value}`}
                 />
                 <Tooltip 
                   contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: '16px' }}
                   formatter={(value: number, name: string) => [
                     formatCurrency(value), 
                     name === 'currentYear' ? `Année ${new Date().getFullYear()}` : `Année ${new Date().getFullYear() - 1}`
                   ]}
                 />
                 <Area 
                   type="monotone" 
                   dataKey="lastYear" 
                   stroke="var(--color-secondary)" 
                   fillOpacity={1} 
                   fill="url(#colorLastYear)" 
                   strokeWidth={2}
                 />
                 <Area 
                   type="monotone" 
                   dataKey="currentYear" 
                   stroke="var(--color-primary-container)" 
                   fillOpacity={1} 
                   fill="url(#colorCurrentYear)" 
                   strokeWidth={3}
                 />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Cash Flow Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ 
            y: -4,
            boxShadow: "0 22px 30px -5px rgba(0, 0, 0, 0.04), 0 8px 12px -6px rgba(0, 0, 0, 0.04)"
          }}
          transition={{ 
            type: "spring",
            stiffness: 300,
            damping: 25,
            opacity: { delay: 0.05, duration: 0.3 }
          }}
          className="lg:col-span-12 bg-white p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] shadow-sm border border-outline-variant relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 flex items-center gap-2 pointer-events-none opacity-5">
            <Wallet size={120} />
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 relative z-10">
            <div>
              <h3 className="font-display font-bold text-2xl">Trésorerie & Marges</h3>
              <p className="text-on-surface-variant text-sm font-sans opacity-70">Différentiel entre revenus collectés et charges variables</p>
            </div>
            
            <div className="flex bg-background p-1 rounded-2xl border border-outline-variant">
              {[6, 12].map((range) => (
                <button
                  key={range}
                  onClick={() => setCashFlowRange(range)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    cashFlowRange === range 
                      ? "bg-primary-container text-white shadow-lg shadow-primary-container/20" 
                      : "text-on-surface-variant hover:bg-surface"
                  )}
                >
                  {range} Mois
                </button>
              ))}
            </div>
          </div>

          <div className="h-[300px] sm:h-[400px]">
            {cashFlowData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashFlowData}>
                  <defs>
                    <linearGradient id="colorCashFlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary-container)" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="var(--color-primary-container)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-variant)" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 10, fontWeight: 600 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 10 }}
                    tickFormatter={(value) => `${value} €`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: '16px', borderTop: '4px solid var(--color-primary-container)' }}
                    formatter={(value: number) => [formatCurrency(value), "Cash Flow"]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="cashFlow" 
                    stroke="var(--color-primary-container)" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorCashFlow)" 
                    animationDuration={1500}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="var(--color-secondary)" 
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-on-surface-variant/40">
                <p className="text-sm font-bold uppercase tracking-widest">Données de trésorerie insuffisantes</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Expense Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ 
            y: -4,
            boxShadow: "0 22px 30px -5px rgba(0, 0, 0, 0.04), 0 8px 12px -6px rgba(0, 0, 0, 0.04)"
          }}
          transition={{ 
            type: "spring",
            stiffness: 300,
            damping: 25,
            opacity: { delay: 0.1, duration: 0.3 }
          }}
          className="lg:col-span-12 bg-white p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] shadow-sm border border-outline-variant"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
              <h3 className="font-display font-bold text-2xl">Répartition des Dépenses</h3>
              <p className="text-on-surface-variant text-sm font-sans opacity-70">Analyse détaillée par catégorie de produits</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <select 
                value={expenseMonth}
                onChange={(e) => setExpenseMonth(e.target.value)}
                className="flex-grow sm:flex-none bg-background border border-outline-variant rounded-xl px-3 py-2 text-xs font-bold outline-none"
              >
                <option value="all">Tous les mois</option>
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select 
                value={expenseYear}
                onChange={(e) => setExpenseYear(e.target.value)}
                className="flex-grow sm:flex-none bg-background border border-outline-variant rounded-xl px-3 py-2 text-xs font-bold outline-none"
              >
                <option value="all">Toutes les années</option>
                {YEARS.map(y => <option key={y} value={y.toString()}>{y}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="h-[300px] relative">
              {expenseBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {expenseBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: '16px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-on-surface-variant/40">
                  <CreditCard size={48} className="mb-4 opacity-20" />
                  <p className="text-sm font-bold uppercase tracking-widest">Aucune donnée pour cette période</p>
                </div>
              )}
              {expenseBreakdown.length > 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Total</span>
                  <span className="text-2xl font-display font-bold">
                    {formatCurrency(expenseBreakdown.reduce((acc, curr) => acc + curr.value, 0))}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">Détails des Catégories</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {expenseBreakdown.sort((a, b) => b.value - a.value).map((item, idx) => (
                  <motion.div 
                    key={idx} 
                    whileHover={{ scale: 1.03, x: 3, borderColor: item.color }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="flex items-center justify-between p-3 bg-background border border-outline-variant rounded-2xl cursor-pointer"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-[10px] font-bold uppercase truncate pr-2">{item.name}</span>
                    </div>
                    <span className="text-xs font-display font-bold shrink-0">{formatCurrency(item.value)}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Recent Transactions List */}
      <section className="bg-white rounded-[32px] shadow-sm border border-outline-variant overflow-hidden">
         <div className="p-6 sm:p-8 border-b border-outline-variant flex justify-between items-center">
            <h3 className="font-display font-bold text-xl">Événements de Trésorerie</h3>
         </div>
         <div className="divide-y divide-outline-variant">
            {revenues.slice(0, 4).map((rev) => (
              <motion.div 
                key={rev.id} 
                whileHover={{ x: 6, backgroundColor: "var(--color-surface)" }}
                transition={{ type: "spring", stiffness: 450, damping: 28 }}
                className="p-5 sm:p-6 sm:px-8 flex items-center justify-between hover:bg-background transition-colors gap-4 cursor-pointer"
              >
                <div className="flex items-center gap-4 sm:gap-6 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-background flex items-center justify-center border border-outline-variant text-primary-container shrink-0">
                    <span className="text-[10px] sm:text-xs font-bold font-display">{rev.month.substring(0, 1)}</span>
                  </div>
                  <div className="min-w-0">
                    <h5 className="font-bold font-display text-base sm:text-lg leading-tight truncate">Revenu de {rev.month}</h5>
                    <p className="text-[9px] text-on-surface-variant uppercase font-bold tracking-widest mt-1">Audit interne</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display font-bold text-lg sm:text-xl">{formatCurrency(rev.revenue)}</p>
                  <p className="text-[9px] uppercase font-bold text-secondary tracking-widest">Vérifié</p>
                </div>
              </motion.div>
            ))}
         </div>
      </section>
    </div>
  );
}
