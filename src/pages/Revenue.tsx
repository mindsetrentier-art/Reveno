import { useState } from 'react';
import { useRevenueData } from '../hooks/useFinance';
import { formatCurrency, downloadCSV } from '../lib/utils';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Plus, Trash2, Edit2, X, Check, Filter, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { encryptNumeric } from '../lib/encryption';
import { useCompany } from '../context/CompanyContext';
import { backupData } from '../lib/backup';

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
    const { validateNumericInput, validateStringInput } = await import('../lib/validation');
    
    const monthValidation = validateStringInput(newMonth, 3, 20);
    if (!monthValidation.isValid) {
      alert(monthValidation.error);
      return;
    }

    const revenueValidation = validateNumericInput(newAmount);
    if (!revenueValidation.isValid) {
      alert(revenueValidation.error);
      return;
    }

    if (!auth.currentUser || !selectedCompany) return;

    try {
      const numericRevenue = revenueValidation.numericValue;
      const revenueData = {
        month: newMonth,
        revenue: encryptNumeric(numericRevenue),
        userId: auth.currentUser.uid,
        companyId: selectedCompany.id,
        createdAt: serverTimestamp(),
        isEncrypted: true
      };

      await addDoc(collection(db, 'revenues'), revenueData);
      
      // Automatic Backup System (uses its own encryption too)
      await backupData('REVENUE_CAPTURE', { ...revenueData, revenue: numericRevenue });

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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <p className="text-secondary font-bold text-xs uppercase tracking-[0.2em] mb-2">Gestion de Trésorerie</p>
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-on-surface leading-tight">Suivi des revenus</h1>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap gap-3">
          <div className="flex gap-3 flex-grow sm:flex-grow-0">
            <button className="flex-grow sm:flex-none p-3 bg-white border border-outline-variant rounded-xl text-on-surface-variant hover:text-primary-container transition-colors shadow-sm flex items-center justify-center">
              <Filter size={18} />
            </button>
            <button 
              onClick={handleExport}
              className="flex-grow sm:flex-none p-3 bg-white border border-outline-variant rounded-xl text-on-surface-variant hover:text-primary-container transition-colors shadow-sm flex items-center justify-center"
              title="Exporter CSV"
            >
              <Download size={18} />
            </button>
          </div>
          <button 
            onClick={() => setIsAdding(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary-container text-white font-bold px-6 py-4 sm:py-3 rounded-2xl sm:rounded-xl shadow-lg shadow-primary-container/20 hover:brightness-110 active:scale-95 transition-all text-xs uppercase tracking-widest"
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
            className="bg-white p-6 sm:p-8 rounded-[32px] border border-outline-variant shadow-sm grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 items-end"
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
        
        {/* Mobile List View */}
        <div className="sm:hidden divide-y divide-outline-variant relative z-10">
          {loading ? (
            <div className="p-12 text-center animate-pulse opacity-70 text-on-surface-variant">Chargement...</div>
          ) : revenues.length === 0 ? (
            <div className="p-12 text-center text-on-surface-variant opacity-70">Aucune donnée.</div>
          ) : (
            revenues.map((rev) => (
              <div key={rev.id} className="p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-bold font-display text-lg">Revenu de {rev.month}</h5>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-secondary/10 text-secondary text-[9px] font-black uppercase rounded-md tracking-widest border border-secondary/15">Réglé</span>
                  </div>
                  <button 
                    onClick={() => handleDelete(rev.id)}
                    className="p-2 text-red-500 bg-red-50 rounded-xl"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="bg-surface p-4 rounded-2xl flex justify-between items-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Montant Total</p>
                  <p className="font-display font-bold text-2xl text-primary-container">{formatCurrency(rev.revenue)}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto relative z-10">
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
                    <td className="px-8 py-6 font-display text-lg font-bold truncate max-w-[200px]">Revenu de {rev.month}</td>
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
