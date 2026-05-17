import { useState } from 'react';
import { useRevenueData } from '../hooks/useFinance';
import { formatCurrency, downloadCSV } from '../lib/utils';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Plus, Trash2, Edit2, X, Check, Filter, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCompany } from '../context/CompanyContext';

export default function Revenue() {
  const { selectedCompany, revenues, loading } = useCompany();
  const [isAdding, setIsAdding] = useState(false);
  const [newMonth, setNewMonth] = useState('');
  const [newAmount, setNewAmount] = useState('');

  const handleExport = () => {
    if (revenues.length === 0) return;
    
    const exportData = revenues.map(r => ({
      'Mois': r.month,
      'Revenu': r.revenue,
      'Statut': 'Réglé',
      'Entité': selectedCompany?.name || 'Inconnue'
    }));
    
    downloadCSV(exportData, `${selectedCompany?.name || 'Reveno'}_Export_Revenus.csv`);
  };

  const handleAdd = async () => {
    if (!newMonth || !newAmount || !auth.currentUser || !selectedCompany) return;
    try {
      await addDoc(collection(db, 'revenues'), {
        month: newMonth,
        revenue: parseFloat(newAmount),
        userId: auth.currentUser.uid,
        companyId: selectedCompany.id,
        createdAt: serverTimestamp(),
      });
      setIsAdding(false);
      setNewMonth('');
      setNewAmount('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this institutional record?')) return;
    try {
      await deleteDoc(doc(db, 'revenues', id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-secondary font-bold text-xs uppercase tracking-[0.2em] mb-2">Gestion de Trésorerie</p>
          <h1 className="font-display font-bold text-4xl text-on-surface leading-tight">Suivi des revenus</h1>
        </div>
        <div className="flex gap-3">
          <button className="p-3 bg-white border border-outline-variant rounded-xl text-on-surface-variant hover:text-primary-container transition-colors shadow-sm">
            <Filter size={18} />
          </button>
          <button 
            onClick={handleExport}
            className="p-3 bg-white border border-outline-variant rounded-xl text-on-surface-variant hover:text-primary-container transition-colors shadow-sm"
            title="Exporter CSV"
          >
            <Download size={18} />
          </button>
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-primary-container text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-primary-container/20 hover:brightness-110 active:scale-95 transition-all text-sm uppercase tracking-widest"
          >
            <Plus size={18} />
            <span>Ajouter un Enregistrement</span>
          </button>
        </div>
      </div>

      {/* Add Record Overlay */}
      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="bg-white p-8 rounded-[32px] border border-outline-variant shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6 items-end"
          >
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.25em]">Période de Rapport</label>
              <input 
                type="text" 
                placeholder="ex: Octobre"
                value={newMonth}
                onChange={(e) => setNewMonth(e.target.value)}
                className="w-full bg-background border border-outline-variant rounded-xl px-4 py-3 focus:outline-none focus:border-primary-container transition-colors font-sans"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.25em]">Montant du Revenu</label>
              <input 
                type="number" 
                placeholder="0.00"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className="w-full bg-background border border-outline-variant rounded-xl px-4 py-3 focus:outline-none focus:border-primary-container transition-colors"
              />
            </div>
            <div className="flex gap-3">
              <button 
                onClick={handleAdd}
                className="flex-grow flex items-center justify-center gap-2 bg-primary-container text-white font-bold py-3 rounded-xl uppercase text-xs tracking-widest hover:brightness-110 transition-all"
              >
                <Check size={18} />
                Confirmer
              </button>
              <button 
                onClick={() => setIsAdding(false)}
                className="p-3 bg-background border border-outline-variant rounded-xl text-on-surface-variant"
              >
                <X size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-[32px] border border-outline-variant shadow-sm overflow-hidden relative">
        <div className="absolute inset-0 dot-grid opacity-5 pointer-events-none"></div>
        <div className="overflow-x-auto relative z-10">
          <table className="w-full text-left">
            <thead className="bg-surface border-b border-outline-variant">
              <tr>
                <th className="px-8 py-5 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em]">Période de Rapport</th>
                <th className="px-8 py-5 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em] text-right">Flux de Revenus</th>
                <th className="px-8 py-5 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em] text-center">Statut Audit</th>
                <th className="px-8 py-5 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant text-sm">
              {loading ? (
                <tr><td colSpan={4} className="p-12 text-center animate-pulse opacity-70 text-on-surface-variant">Accès aux registres institutionnels...</td></tr>
              ) : revenues.length === 0 ? (
                <tr><td colSpan={4} className="p-12 text-center text-on-surface-variant opacity-70">Trésorerie vide. Initialisez les enregistrements pour générer des données de performance.</td></tr>
              ) : (
                revenues.map((rev) => (
                  <tr key={rev.id} className="hover:bg-background transition-colors group">
                    <td className="px-8 py-6 font-display text-lg font-bold">Revenu de {rev.month}</td>
                    <td className="px-8 py-6 text-right font-display font-bold text-xl">{formatCurrency(rev.revenue)}</td>
                    <td className="px-8 py-6 text-center">
                       <span className="px-3 py-1 bg-secondary/10 text-secondary text-[10px] font-bold uppercase rounded-full tracking-widest border border-secondary/20">Réglé</span>
                    </td>
                    <td className="px-8 py-6 text-right">
                       <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-2 text-on-surface-variant hover:text-primary-container transition-colors"><Edit2 size={16} /></button>
                          <button 
                            onClick={() => handleDelete(rev.id)}
                            className="p-2 text-on-surface-variant hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
