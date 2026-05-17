import { useRevenueData, useGoalData } from '../hooks/useFinance';
import { formatCurrency, downloadCSV } from '../lib/utils';
import { TrendingUp, Target, CreditCard, ArrowUpRight, Edit2, Check, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion } from 'motion/react';
import { useCompany } from '../context/CompanyContext';
import { useState } from 'react';

export default function Dashboard() {
  const { selectedCompany, revenues, goal, loading: contextLoading, updateGoal } = useCompany();
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [newGoalValue, setNewGoalValue] = useState('');

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
    <div className="space-y-8">
      {/* Welcome Section */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <p className="text-secondary font-bold text-xs uppercase tracking-[0.2em] mb-2 text-center sm:text-left">Analyses Institutionnelles</p>
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-on-surface text-center sm:text-left leading-tight">Performance des Revenus</h1>
        </div>
        <button 
          onClick={handleExport}
          className="w-full sm:w-auto px-6 py-3 bg-white border border-outline-variant rounded-2xl text-on-surface-variant font-bold text-[10px] uppercase tracking-widest hover:bg-surface transition-colors"
        >
          Export CSV
        </button>
      </section>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Growth Chart */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
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
            whileHover={{ y: -5 }}
            className="bg-white p-6 sm:p-8 rounded-[28px] sm:rounded-[32px] shadow-sm border border-outline-variant space-y-4"
          >
            <div className="flex justify-between items-center text-on-surface-variant">
              <span className="text-[10px] font-bold uppercase tracking-widest">Moyenne Mensuelle</span>
              <CreditCard size={18} />
            </div>
            <h4 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">{formatCurrency(avgMonthly)}</h4>
            <div className="flex items-center gap-2 text-primary-container text-[10px] font-bold uppercase tracking-widest">
              <span className="bg-primary-container/10 px-2 py-0.5 rounded-full">+12.4%</span>
              <span className="opacity-60 hidden xs:inline">vs dernier exercice</span>
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white p-6 sm:p-8 rounded-[28px] sm:rounded-[32px] shadow-sm border border-outline-variant space-y-4"
          >
            <div className="flex justify-between items-center text-on-surface-variant">
              <span className="text-[10px] font-bold uppercase tracking-widest">Objectif Global</span>
              <div className="flex gap-2">
                {isEditingGoal ? (
                  <>
                    <button 
                      onClick={async () => {
                        await updateGoal(parseFloat(newGoalValue));
                        setIsEditingGoal(false);
                      }}
                      className="p-1 hover:bg-green-50 text-green-600 rounded-md"
                    >
                      <Check size={14} />
                    </button>
                    <button onClick={() => setIsEditingGoal(false)} className="p-1 hover:bg-red-50 text-red-600 rounded-md">
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => {
                      setNewGoalValue(goal ? (goal.monthlyGoal).toString() : '0');
                      setIsEditingGoal(true);
                    }}
                    className="p-1 hover:bg-surface rounded-md"
                  >
                    <Edit2 size={14} />
                  </button>
                )}
                <Target size={18} className="text-secondary" />
              </div>
            </div>
            {isEditingGoal ? (
              <div className="flex items-end gap-2">
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

      {/* Recent Transactions List */}
      <section className="bg-white rounded-[32px] shadow-sm border border-outline-variant overflow-hidden">
         <div className="p-6 sm:p-8 border-b border-outline-variant flex justify-between items-center">
            <h3 className="font-display font-bold text-xl">Événements de Trésorerie</h3>
         </div>
         <div className="divide-y divide-outline-variant">
            {revenues.slice(0, 4).map((rev) => (
              <div key={rev.id} className="p-5 sm:p-6 sm:px-8 flex items-center justify-between hover:bg-background transition-colors gap-4">
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
              </div>
            ))}
         </div>
      </section>
    </div>
  );
}
