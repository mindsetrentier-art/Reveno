import { useRevenueData, useGoalData } from '../hooks/useFinance';
import { formatCurrency, downloadCSV, cn } from '../lib/utils';
import { exportToPDF } from '../lib/pdfExport';
import { TrendingUp, Target, CreditCard, ArrowUpRight, ArrowDownRight, Edit2, Check, X, Wallet, Calendar } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { useCompany } from '../context/CompanyContext';
import { useState, useMemo } from 'react';
import WeatherWidget from '../components/WeatherWidget';
import ChartContainer from '../components/ChartContainer';
import { MONTHS, YEARS } from '../constants';
import { format, isWithinInterval, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

const getRevenueDate = (rev: any): Date => {
  const monthIdx = MONTHS.indexOf(rev.month);
  let year = new Date().getFullYear();
  if (rev.createdAt) {
    const d = rev.createdAt.toDate ? rev.createdAt.toDate() : new Date(rev.createdAt);
    year = d.getFullYear();
  }
  return new Date(year, monthIdx, 15);
};

const presets = [
  { label: '3 Derniers Mois', getRange: () => ({ start: startOfMonth(subMonths(new Date(), 2)), end: endOfMonth(new Date()) }) },
  { label: '6 Derniers Mois', getRange: () => ({ start: startOfMonth(subMonths(new Date(), 5)), end: endOfMonth(new Date()) }) },
  { label: '12 Derniers Mois', getRange: () => ({ start: startOfMonth(subMonths(new Date(), 11)), end: endOfMonth(new Date()) }) },
  { label: 'Cette Année', getRange: () => ({ start: startOfYear(new Date()), end: endOfYear(new Date()) }) },
  { label: 'Toutes les données', getRange: () => ({ start: new Date(2020, 0, 1), end: new Date(2030, 11, 31) }) },
];

export default function Dashboard() {
  const { selectedCompany, revenues, detailedEntries, goal, loading: contextLoading, updateGoal, categories } = useCompany();
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [newGoalValue, setNewGoalValue] = useState('');

  // Primary Date Range Picker States (defaults to last 6 months)
  const [startDate, setStartDate] = useState<string>(format(startOfMonth(subMonths(new Date(), 5)), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Filter Revenues and Expenses based on Master Date Range
  const filteredRevenues = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return (revenues || [])
      .filter(rev => {
        const revDate = getRevenueDate(rev);
        return isWithinInterval(revDate, { start, end });
      })
      .sort((a, b) => getRevenueDate(a).getTime() - getRevenueDate(b).getTime());
  }, [revenues, startDate, endDate]);

  const filteredDetailedEntries = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return (detailedEntries || []).filter(entry => {
      const entryDate = entry.date;
      return isWithinInterval(entryDate, { start, end });
    });
  }, [detailedEntries, startDate, endDate]);

  const expenseBreakdown = useMemo(() => {
    const totals: Record<string, number> = {};
    
    filteredDetailedEntries.forEach(entry => {
      Object.entries(entry.breakdown || {}).forEach(([catId, amount]) => {
        totals[catId] = (totals[catId] || 0) + (amount as number);
      });
    });

    return categories.map(cat => ({
      name: cat.label,
      value: totals[cat.id] || 0,
      color: cat.color
    })).filter(item => item.value > 0);
  }, [filteredDetailedEntries, categories]);

  const cashFlowData = useMemo(() => {
    return filteredRevenues.map(r => {
      const revDate = getRevenueDate(r);
      const revYear = revDate.getFullYear();
      
      const monthlyTotalExpense = filteredDetailedEntries
        .filter(e => e.month === r.month && (!e.year || e.year === revYear))
        .reduce((sum, e) => sum + (e.total || 0), 0);

      return {
        name: `${r.month.substring(0, 3).toUpperCase()} ${revYear.toString().substring(2)}`,
        revenue: r.revenue,
        expenses: monthlyTotalExpense,
        cashFlow: r.revenue - monthlyTotalExpense,
      };
    });
  }, [filteredRevenues, filteredDetailedEntries]);

  const annualGrowthData = useMemo(() => {
    const selectedEndYear = new Date(endDate).getFullYear();
    const comparisonYear = selectedEndYear - 1;

    const currentYearRevenues = new Array(12).fill(0);
    const lastYearRevenues = new Array(12).fill(0);

    revenues.forEach(r => {
      const revDate = getRevenueDate(r);
      const year = revDate.getFullYear();
      const monthIndex = MONTHS.indexOf(r.month);
      if (monthIndex !== -1) {
        if (year === selectedEndYear) {
          currentYearRevenues[monthIndex] += r.revenue;
        } else if (year === comparisonYear) {
          lastYearRevenues[monthIndex] += r.revenue;
        }
      }
    });

    return MONTHS.map((month, index) => ({
      name: month.substring(0, 3).toUpperCase(),
      currentYear: currentYearRevenues[index],
      lastYear: lastYearRevenues[index]
    }));
  }, [revenues, endDate]);

  const handleExport = () => {
    if (filteredRevenues.length === 0) return;
    
    const exportData = filteredRevenues.map(r => ({
      'Mois': r.month,
      'Revenu': r.revenue,
      'Statut': 'Confirmé',
      'Entité': selectedCompany?.name || 'Reveno'
    }));
    
    downloadCSV(exportData, `${selectedCompany?.name || 'Reveno'}_Tresorerie_Filtré.csv`);
  };

  const totalRevenue = useMemo(() => {
    return filteredRevenues.reduce((acc, curr) => acc + curr.revenue, 0);
  }, [filteredRevenues]);

  const avgMonthly = useMemo(() => {
    return filteredRevenues.length > 0 ? totalRevenue / filteredRevenues.length : 0;
  }, [filteredRevenues, totalRevenue]);

  const revenueMoMTrend = useMemo(() => {
    const activeRevenues = filteredRevenues.length > 0 
      ? filteredRevenues 
      : [...revenues].sort((a, b) => getRevenueDate(a).getTime() - getRevenueDate(b).getTime());
      
    if (activeRevenues.length === 0) return null;

    const latestItem = activeRevenues[activeRevenues.length - 1];
    const latestDate = getRevenueDate(latestItem);
    const latestYear = latestDate.getFullYear();

    const prevDate = subMonths(latestDate, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonthName = MONTHS[prevDate.getMonth()];

    const prevItem = revenues.find(r => {
      const rDate = getRevenueDate(r);
      return rDate.getFullYear() === prevYear && r.month === prevMonthName;
    });

    const latestVal = latestItem.revenue;
    const prevVal = prevItem ? prevItem.revenue : 0;

    let percentChange = 0;
    if (prevVal > 0) {
      percentChange = ((latestVal - prevVal) / prevVal) * 100;
    } else if (latestVal > 0) {
      percentChange = 100;
    }

    return {
      latestMonth: latestItem.month,
      latestYear,
      latestVal,
      prevMonth: prevMonthName,
      prevYear,
      prevVal,
      percentChange,
      hasPrev: !!prevItem
    };
  }, [filteredRevenues, revenues]);

  const progressToGoal = useMemo(() => {
    return goal ? (avgMonthly / goal.monthlyGoal) * 100 : 0;
  }, [goal, avgMonthly]);

  const chartData = useMemo(() => {
    return filteredRevenues.map(r => {
      const yearStr = getRevenueDate(r).getFullYear().toString().substring(2);
      return {
        name: `${r.month.substring(0, 3).toUpperCase()} ${yearStr}`,
        revenue: r.revenue,
        original: r
      };
    });
  }, [filteredRevenues]);

  const handlePresetClick = (preset: typeof presets[0]) => {
    const range = preset.getRange();
    setStartDate(format(range.start, 'yyyy-MM-dd'));
    setEndDate(format(range.end, 'yyyy-MM-dd'));
    setShowDatePicker(false);
  };

  if (contextLoading) {
    return (
      <div className="animate-pulse space-y-8">
        <div className="h-32 bg-surface rounded-3xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-40 bg-surface rounded-3xl"></div>
          <div className="h-40 bg-surface rounded-3xl"></div>
          <div className="h-40 bg-surface rounded-3xl"></div>
        </div>
      </div>
    );
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
            className="flex-1 sm:flex-none px-6 py-3 bg-white border border-outline-variant rounded-2xl text-on-surface-variant font-bold text-[10px] uppercase tracking-widest hover:bg-surface transition-colors cursor-pointer"
          >
            Export PDF
          </button>
          <button 
            onClick={handleExport}
            className="flex-1 sm:flex-none px-6 py-3 bg-white border border-outline-variant rounded-2xl text-on-surface-variant font-bold text-[10px] uppercase tracking-widest hover:bg-surface transition-colors cursor-pointer"
          >
            Export CSV
          </button>
        </div>
      </section>

      {/* Weather Widget Integration */}
      <div className="flex justify-end -mt-4 -mb-4">
        <WeatherWidget />
      </div>

      {/* Interactive Date Range Selector (DateRangePicker) */}
      <section className="bg-white p-5 rounded-[32px] border border-outline-variant shadow-sm flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4" data-html2canvas-ignore>
        <div className="flex flex-wrap gap-2">
          {presets.map(preset => {
            const range = preset.getRange();
            const isSelected = startDate === format(range.start, 'yyyy-MM-dd') && endDate === format(range.end, 'yyyy-MM-dd');
            return (
              <button
                key={preset.label}
                onClick={() => handlePresetClick(preset)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border cursor-pointer",
                  isSelected
                    ? "bg-[#5A5A40] text-white border-[#5A5A40] shadow-sm shadow-[#5A5A40]/15"
                    : "bg-surface border-outline-variant text-[#5A5A40] hover:bg-outline-variant/10"
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="relative shrink-0">
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-4 bg-[#F9F9F6] border border-outline-variant hover:border-[#5A5A40] rounded-2xl px-5 py-3 text-xs font-semibold cursor-pointer transition-all"
          >
            <span className="flex items-center gap-2 text-on-surface-variant">
              <Calendar size={14} className="text-[#5A5A40]" />
              <span>Période :</span>
            </span>
            <span className="text-[#5A5A40] font-bold">
              {format(new Date(startDate), 'dd MMM yyyy', { locale: fr })} – {format(new Date(endDate), 'dd MMM yyyy', { locale: fr })}
            </span>
          </button>

          <AnimatePresence>
            {showDatePicker && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="fixed inset-0 z-40 bg-black/5"
                  onClick={() => setShowDatePicker(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 15, scale: 0.95 }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 300, 
                    damping: 25,
                    mass: 0.8
                  }}
                  className="absolute right-0 top-full mt-2 z-50 bg-white border border-outline-variant rounded-3xl shadow-2xl p-4 min-w-[280px]"
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
                      caption_label: "text-xs font-black uppercase text-on-surface-variant tracking-wider px-8",
                      nav: "space-x-1 flex items-center",
                      button_previous: "absolute left-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 transition-opacity",
                      button_next: "absolute right-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 transition-opacity",
                      month_grid: "w-full border-collapse space-y-1",
                      weekdays: "flex",
                      weekday: "text-on-surface-variant rounded-md w-9 font-bold text-[10px] uppercase tracking-widest text-center",
                      week: "flex w-full mt-2",
                      day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-surface rounded-xl transition-all flex items-center justify-center cursor-pointer text-xs",
                      range_end: "day-range-end",
                      selected: "bg-[#5A5A40] text-white hover:bg-[#5A5A40] hover:text-white focus:bg-[#5A5A40] focus:text-white rounded-xl font-bold",
                      today: "bg-surface text-[#5A5A40] font-black border border-[#5A5A40]",
                      outside: "text-on-surface-variant opacity-30",
                      disabled: "text-on-surface-variant opacity-30",
                      range_middle: "aria-selected:bg-[#5A5A40]/10 aria-selected:text-[#5A5A40] rounded-none",
                      hidden: "invisible",
                    }}
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Growth Chart */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          whileHover={{ 
            y: -4,
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.03), 0 8px 10px -6px rgba(0, 0, 0, 0.03)"
          }}
          transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.1 }}
          className="lg:col-span-8 bg-white p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] shadow-sm border border-outline-variant flex flex-col min-h-[350px] sm:min-h-[400px] relative overflow-hidden"
        >
          <div className="absolute inset-0 dot-grid opacity-10 pointer-events-none"></div>
          <div className="flex flex-col sm:flex-row justify-between items-start mb-8 relative z-10 gap-4">
            <div>
              <h3 className="font-display font-bold text-2xl">Flux Mensuel</h3>
              <p className="text-on-surface-variant text-sm font-sans opacity-70">Tendances des revenus sur la période sélectionnée</p>
            </div>
            
            {/* Mini History Bar (Activity in selected range) */}
            <div className="w-full sm:w-auto flex flex-col items-end gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">Activité Périodique</span>
              <div className="flex gap-1 h-8 items-end">
                {filteredRevenues.slice(-12).map((r, i) => {
                  const max = Math.max(...filteredRevenues.map(rev => rev.revenue), 1);
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
          
          <div className="flex-grow w-full min-w-0 min-h-[250px] sm:min-h-[300px] h-[250px] sm:h-[300px] relative z-10">
            {chartData.length > 0 ? (
              <ChartContainer aspect={1.5}>
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
              </ChartContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-on-surface-variant/40">
                <Calendar size={48} className="mb-4 opacity-20" />
                <p className="text-sm font-bold uppercase tracking-widest">Aucun revenu sur cette période</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Side Stats */}
        <div className="lg:col-span-4 space-y-6">
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
              <span className="text-[10px] font-bold uppercase tracking-widest">Moyenne Mensuelle (Sélection)</span>
              <motion.div
                variants={{
                  hover: { rotate: 12, scale: 1.2, color: "var(--color-primary-container)" }
                }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
              >
                <CreditCard size={18} />
              </motion.div>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">{formatCurrency(avgMonthly)}</h4>
              {revenueMoMTrend && (
                <div className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold leading-none shrink-0",
                  revenueMoMTrend.percentChange >= 0 
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                    : "bg-rose-50 text-rose-700 border border-rose-100"
                )}>
                  {revenueMoMTrend.percentChange >= 0 ? (
                    <ArrowUpRight size={13} className="stroke-[3]" />
                  ) : (
                    <ArrowDownRight size={13} className="stroke-[3]" />
                  )}
                  <span>{revenueMoMTrend.percentChange >= 0 ? "+" : ""}{revenueMoMTrend.percentChange.toFixed(1)}% MoM</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-primary-container text-[10px] font-bold uppercase tracking-widest mt-1">
              <span className="bg-primary-container/10 px-2 py-0.5 rounded-full">Trésorerie</span>
              {revenueMoMTrend && (
                <span className="text-on-surface-variant/60 font-semibold tracking-normal lowercase">
                  {revenueMoMTrend.latestMonth} : {formatCurrency(revenueMoMTrend.latestVal)} vs {formatCurrency(revenueMoMTrend.prevVal)}
                </span>
              )}
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
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">{goal ? formatCurrency(goal.monthlyGoal * 12) : '0 €'}</h4>
                {revenueMoMTrend && (
                  <div className={cn(
                    "flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold leading-none shrink-0",
                    revenueMoMTrend.percentChange >= 0 
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                      : "bg-rose-50 text-rose-700 border border-rose-100"
                  )}>
                    {revenueMoMTrend.percentChange >= 0 ? (
                      <ArrowUpRight size={13} className="stroke-[3]" />
                    ) : (
                      <ArrowDownRight size={13} className="stroke-[3]" />
                    )}
                    <span>{revenueMoMTrend.percentChange >= 0 ? "+" : ""}{revenueMoMTrend.percentChange.toFixed(1)}% MoM</span>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-4 pt-1">
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
              <p className="text-on-surface-variant text-sm font-sans opacity-70">Comparatif des revenus par mois, Année N vs Année N-1 (N basée sur la fin de période)</p>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-primary-container"></div>
                <span>Année {new Date(endDate).getFullYear()}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-secondary"></div>
                <span>Année {new Date(endDate).getFullYear() - 1}</span>
              </div>
            </div>
          </div>

          <div className="h-[300px] sm:h-[400px] w-full min-w-0 min-h-[300px] sm:min-h-[400px]">
            <ChartContainer aspect={1.5}>
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
                     name === 'currentYear' ? `Année ${new Date(endDate).getFullYear()}` : `Année ${new Date(endDate).getFullYear() - 1}`
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
            </ChartContainer>
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
              <p className="text-on-surface-variant text-sm font-sans opacity-70">Différentiel entre revenus collectés et charges variables sur la plage sélectionnée</p>
            </div>
            
            <div className="flex items-center gap-2 bg-[#F9F9F6] border border-outline-variant rounded-xl px-4 py-2 text-xs font-semibold text-[#5A5A40]">
              <Calendar size={13} />
              <span>Analyse Globale de Période</span>
            </div>
          </div>

          <div className="h-[300px] sm:h-[400px] w-full min-w-0 min-h-[300px] sm:min-h-[400px]">
            {cashFlowData.length > 0 ? (
              <ChartContainer aspect={1.5}>
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
              </ChartContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-on-surface-variant/40">
                <Calendar size={48} className="mb-4 opacity-20" />
                <p className="text-sm font-bold uppercase tracking-widest">Données de trésorerie insuffisantes sur cette période</p>
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
              <p className="text-on-surface-variant text-sm font-sans opacity-70">Analyse détaillée par catégorie de charges variables sur la sélection</p>
            </div>
            <div className="flex items-center gap-2 bg-[#F9F9F6] border border-outline-variant rounded-xl px-4 py-2 text-xs font-semibold text-[#5A5A40] shrink-0">
              <Calendar size={13} />
              <span>{format(new Date(startDate), 'dd MMM yyyy', { locale: fr })} – {format(new Date(endDate), 'dd MMM yyyy', { locale: fr })}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="h-[300px] relative w-full min-w-0 min-h-[300px] flex items-center justify-center">
              {expenseBreakdown.length > 0 ? (
                <ChartContainer>
                  <PieChart>
                    <Pie
                      data={expenseBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius="60%"
                      outerRadius="85%"
                      paddingAngle={4}
                      dataKey="value"
                      animationDuration={1000}
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
                </ChartContainer>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-on-surface-variant/40">
                  <CreditCard size={48} className="mb-4 opacity-20" />
                  <p className="text-sm font-bold uppercase tracking-widest">Aucune dépense pour cette période</p>
                </div>
              )}
              {expenseBreakdown.length > 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/60">Total Dépensé</span>
                  <span className="text-xl sm:text-2xl font-display font-black text-on-surface">
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
            <h3 className="font-display font-bold text-xl">Événements de Trésorerie (Période sélectionnés)</h3>
         </div>
         <div className="divide-y divide-outline-variant">
            {filteredRevenues.length > 0 ? (
              filteredRevenues.slice(-4).reverse().map((rev) => (
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
              ))
            ) : (
              <div className="p-8 text-center text-on-surface-variant/40">
                <p className="text-sm font-bold uppercase tracking-widest">Aucun historique sur cette période</p>
              </div>
            )}
         </div>
      </section>
    </div>
  );
}
