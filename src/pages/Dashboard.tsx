import { useRevenueData, useGoalData } from '../hooks/useFinance';
import { formatCurrency, downloadCSV } from '../lib/utils';
import { TrendingUp, Target, CreditCard, ArrowUpRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion } from 'motion/react';
import { useCompany } from '../context/CompanyContext';

export default function Dashboard() {
  const { selectedCompany } = useCompany();
  const { data: revenues, loading: revLoading } = useRevenueData(selectedCompany?.id);
  const { goal, loading: goalLoading } = useGoalData(selectedCompany?.id);

  const handleExport = () => {
    if (revenues.length === 0) return;
    
    const exportData = revenues.map(r => ({
      Month: r.month,
      Revenue: r.revenue,
      Status: 'Confirmed',
      Entity: selectedCompany?.name || 'Reveno'
    }));
    
    downloadCSV(exportData, `${selectedCompany?.name || 'Reveno'}_Treasury_Snapshot.csv`);
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

  if (revLoading || goalLoading) {
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
      <section>
        <p className="text-secondary font-bold text-xs uppercase tracking-[0.2em] mb-2">Institutional Analytics</p>
        <h1 className="font-serif font-medium text-4xl text-on-surface">Revenue Performance</h1>
      </section>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Growth Chart */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="md:col-span-8 bg-white p-8 rounded-[40px] shadow-sm border border-outline-variant flex flex-col min-h-[400px] relative overflow-hidden"
        >
          <div className="absolute inset-0 dot-grid opacity-10 pointer-events-none"></div>
          <div className="flex justify-between items-start mb-8 relative z-10">
            <div>
              <h3 className="font-serif font-medium text-2xl">Monthly Flow</h3>
              <p className="text-on-surface-variant text-sm serif italic">Revenue trends over the last 6 cycles</p>
            </div>
            <div className="p-2 bg-[#F5F5F0] rounded-xl text-primary-container">
              <TrendingUp size={20} />
            </div>
          </div>
          
          <div className="flex-grow relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(90, 90, 64, 0.1)" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#7E7E74', fontSize: 10, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: 'rgba(90, 90, 64, 0.05)' }}
                  contentStyle={{ backgroundColor: '#F5F5F0', border: '1px solid rgba(90, 90, 64, 0.1)', borderRadius: '16px', fontFamily: 'Inter' }}
                />
                <Bar 
                  dataKey="revenue" 
                  radius={[8, 8, 0, 0]}
                  barSize={40}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.revenue >= (goal?.monthlyGoal || 0) ? '#5A5A40' : '#A3AD9F'} 
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
            className="bg-white p-8 rounded-[32px] shadow-sm border border-outline-variant space-y-4"
          >
            <div className="flex justify-between items-center text-on-surface-variant">
              <span className="text-[10px] font-bold uppercase tracking-widest">Average Monthly</span>
              <CreditCard size={18} />
            </div>
            <h4 className="font-serif text-4xl font-medium">{formatCurrency(avgMonthly)}</h4>
            <div className="flex items-center gap-2 text-primary-container text-xs font-bold uppercase tracking-widest">
              <span className="bg-[#E8E8E0] px-2 py-0.5 rounded-full">+12.4%</span>
              <span className="opacity-60">vs last fiscal year</span>
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white p-8 rounded-[32px] shadow-sm border border-outline-variant space-y-4"
          >
            <div className="flex justify-between items-center text-on-surface-variant">
              <span className="text-[10px] font-bold uppercase tracking-widest">Global Goal</span>
              <Target size={18} className="text-secondary" />
            </div>
            <h4 className="font-serif text-4xl font-medium">{goal ? formatCurrency(goal.monthlyGoal * 12) : '$0'}</h4>
            <div className="space-y-4 pt-2">
              <div className="w-full bg-[#F5F5F0] h-1.5 rounded-full overflow-hidden">
                <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${Math.min(progressToGoal, 100)}%` }}
                   className="h-full bg-[#5A5A40]"
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                <span className="text-on-surface-variant">Monthly Progress</span>
                <span className="text-primary-container">{progressToGoal.toFixed(1)}%</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Recent Transactions List */}
      <section className="bg-white rounded-[32px] shadow-sm border border-outline-variant overflow-hidden">
         <div className="p-8 border-b border-outline-variant flex justify-between items-center">
            <h3 className="font-serif font-medium text-xl">Recent Treasury Events</h3>
            <button 
              onClick={handleExport}
              className="text-primary-container text-xs font-bold uppercase tracking-widest hover:underline"
            >
              Auditor View (Export CSV)
            </button>
         </div>
         <div className="divide-y divide-outline-variant">
            {revenues.slice(0, 4).map((rev) => (
              <div key={rev.id} className="p-6 px-8 flex items-center justify-between hover:bg-[#F9F9F6] transition-colors">
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 rounded-2xl bg-[#F5F5F0] flex items-center justify-center border border-outline-variant text-[#5A5A40]">
                    <span className="text-xs font-bold serif font-serif italic">{rev.month.substring(0, 1)}</span>
                  </div>
                  <div>
                    <h5 className="font-medium serif font-serif italic text-lg leading-none">{rev.month} Release</h5>
                    <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest mt-1">Institutional Settlement</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-serif font-medium text-xl">{formatCurrency(rev.revenue)}</p>
                  <p className="text-[10px] uppercase font-bold text-primary-container tracking-widest">Verified</p>
                </div>
              </div>
            ))}
         </div>
      </section>
    </div>
  );
}
