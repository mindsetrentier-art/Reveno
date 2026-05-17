import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { formatCurrency } from '../lib/utils';
import { useCompany } from '../context/CompanyContext';
import { backupData } from '../lib/backup';
import { encryptNumeric, decryptNumeric } from '../lib/encryption';
import { motion, AnimatePresence } from 'motion/react';
import { Save, Trash2, Plus, ArrowRight, History, Calculator, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

const CATEGORIES = [
  { id: 'fdj', label: 'FDJ (Française des Jeux)', color: 'bg-blue-600' },
  { id: 'tabac', label: 'Tabac', color: 'bg-red-700' },
  { id: 'prepaye', label: 'Prépayé / Moyens Paiement', color: 'bg-purple-600' },
  { id: 'dgfip', label: 'DGFIP Paiement de proximité', color: 'bg-indigo-500' },
  { id: 'nirio', label: 'Nirio', color: 'bg-emerald-600' },
  { id: 'transport', label: 'Transport', color: 'bg-green-700' },
  { id: 'fumeurs', label: 'Articles fumeurs', color: 'bg-orange-600' },
  { id: 'bar10', label: 'Bar boisson 10%', color: 'bg-amber-500' },
  { id: 'bar20', label: 'Bar boisson 20%', color: 'bg-amber-700' },
  { id: 'vape', label: 'Vape', color: 'bg-cyan-500' },
  { id: 'tabletterie', label: 'Tabletterie', color: 'bg-teal-500' },
  { id: 'nickel', label: 'Compte Nickel', color: 'bg-orange-700' },
];

interface DetailedEntryData {
  id: string;
  date: any;
  breakdown: Record<string, number>;
  total: number;
  userId: string;
  companyId: string;
}

export default function DetailedEntry() {
  const { selectedCompany } = useCompany();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [entries, setEntries] = useState<DetailedEntryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!auth.currentUser || !selectedCompany) return;

    const q = query(
      collection(db, 'detailed_entries'),
      where('userId', '==', auth.currentUser.uid),
      where('companyId', '==', selectedCompany.id),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEntries(snapshot.docs.map(doc => {
        const data = doc.data() as any;
        if (data.isEncrypted) {
          const decryptedBreakdown: Record<string, number> = {};
          Object.entries(data.breakdown).forEach(([k, v]) => {
            decryptedBreakdown[k] = decryptNumeric(v as string);
          });
          return {
            id: doc.id,
            ...data,
            breakdown: decryptedBreakdown,
            total: decryptNumeric(data.total)
          };
        }
        return { id: doc.id, ...data };
      }) as DetailedEntryData[]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedCompany]);

  const handleAmountChange = (id: string, value: string) => {
    setAmounts(prev => ({ ...prev, [id]: value }));
  };

  const calculateTotal = (): number => {
    return Object.keys(amounts).reduce<number>((acc, key) => acc + (parseFloat(amounts[key]) || 0), 0);
  };

  const handleSave = async () => {
    if (!auth.currentUser || !selectedCompany) return;
    
    const numericBreakdown: Record<string, number> = {};
    (Object.entries(amounts) as [string, string][]).forEach(([key, val]) => {
      const num = parseFloat(val);
      if (num > 0) numericBreakdown[key] = num;
    });

    if (Object.keys(numericBreakdown).length === 0) return;

    setIsSaving(true);
    try {
      const numericTotal = calculateTotal();
      const encryptedBreakdown: Record<string, string> = {};
      Object.entries(numericBreakdown).forEach(([key, val]) => {
        encryptedBreakdown[key] = encryptNumeric(val);
      });

      const entryData = {
        date: serverTimestamp(),
        breakdown: encryptedBreakdown,
        total: encryptNumeric(numericTotal),
        userId: auth.currentUser.uid,
        companyId: selectedCompany.id,
        isEncrypted: true
      };

      await addDoc(collection(db, 'detailed_entries'), entryData);
      await backupData('DETAILED_ENTRY_CAPTURE', { ...entryData, breakdown: numericBreakdown, total: numericTotal });
      
      setAmounts({});
      alert('Saisie enregistrée avec succès.');
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Voulez-vous supprimer cet enregistrement ?')) return;
    await deleteDoc(doc(db, 'detailed_entries', id));
  };

  return (
    <div className="space-y-10 pb-20">
      <section>
        <p className="text-secondary font-bold text-xs uppercase tracking-[0.2em] mb-2">Opérations Journalières</p>
        <h1 className="font-display font-bold text-4xl text-on-surface">Saisie Détaillée</h1>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Entry Form */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-[40px] border border-outline-variant shadow-sm overflow-hidden">
            <div className="p-8 border-b border-outline-variant flex justify-between items-center bg-surface/50">
              <div className="flex items-center gap-3">
                <Calculator className="text-primary-container" size={24} />
                <h2 className="font-display font-bold text-xl">Nouvelle Saisie</h2>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Total calculé</p>
                <p className="font-display font-bold text-2xl text-primary-container">{formatCurrency(calculateTotal())}</p>
              </div>
            </div>
            
            <div className="p-8 space-y-4">
              {CATEGORIES.map((cat) => (
                <div key={cat.id} className="group flex items-center gap-4 p-4 rounded-2xl hover:bg-background transition-all border border-transparent hover:border-outline-variant">
                  <div className={cn("w-2 h-10 rounded-full shrink-0", cat.color)} />
                  <div className="flex-grow">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
                      {cat.label}
                    </label>
                    <div className="relative">
                       <input 
                         type="number"
                         placeholder="0.00"
                         value={amounts[cat.id] || ''}
                         onChange={(e) => handleAmountChange(cat.id, e.target.value)}
                         className="w-full bg-background/50 border border-outline-variant rounded-xl px-4 py-3 focus:outline-none focus:border-primary-container transition-all text-lg font-display font-bold"
                       />
                       <span className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold text-sm">€</span>
                    </div>
                  </div>
                  {amounts[cat.id] && parseFloat(amounts[cat.id]) > 0 && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <CheckCircle2 className="text-green-500" size={20} />
                    </motion.div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-8 bg-surface/50 border-t border-outline-variant">
              <button 
                onClick={handleSave}
                disabled={isSaving || calculateTotal() === 0}
                className="w-full bg-primary-container text-white py-5 rounded-2xl font-display font-bold uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl shadow-primary-container/20"
              >
                {isSaving ? 'Enregistrement...' : (
                  <>
                    <Save size={18} />
                    Sauvegarder la session
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* History */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-[40px] border border-outline-variant shadow-sm overflow-hidden h-fit">
            <div className="p-8 border-b border-outline-variant flex items-center gap-3">
              <History className="text-secondary" size={24} />
              <h2 className="font-display font-bold text-xl">Derniers Registres</h2>
            </div>
            
            <div className="divide-y divide-outline-variant max-h-[800px] overflow-y-auto">
              {loading ? (
                <div className="p-12 text-center animate-pulse text-on-surface-variant font-bold uppercase text-[10px] tracking-widest">
                  Chargement de l'historique...
                </div>
              ) : entries.length === 0 ? (
                <div className="p-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto text-on-surface-variant/20">
                    <History size={32} />
                  </div>
                  <p className="text-on-surface-variant text-sm font-medium">Aucun enregistrement détaillé.</p>
                </div>
              ) : (
                entries.map((entry) => (
                  <div key={entry.id} className="p-6 hover:bg-background transition-colors group">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                          {entry.date?.toDate().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                        <p className="font-display font-bold text-xl">{formatCurrency(entry.total)}</p>
                      </div>
                      <button 
                        onClick={() => handleDelete(entry.id)}
                        className="p-2 text-on-surface-variant hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                       {(Object.entries(entry.breakdown) as [string, number][]).map(([key, val]) => (
                         <div key={key} className="bg-surface border border-outline-variant px-3 py-1.5 rounded-xl flex items-center gap-2">
                           <div className={cn("w-1.5 h-1.5 rounded-full", CATEGORIES.find(c => c.id === key)?.color)} />
                           <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">
                             {CATEGORIES.find(c => c.id === key)?.id.toUpperCase()}: {formatCurrency(val)}
                           </span>
                         </div>
                       ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-primary-container p-10 rounded-[40px] text-white space-y-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16 blur-3xl"></div>
             <div className="relative z-10 space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Récapitulatif Fiscaux</p>
                <h3 className="font-display text-2xl font-bold">Audit Automatique</h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  Chaque saisie détaillée est automatiquement indexée et sauvegardée pour votre audit annuel. 
                  Vous pouvez modifier les montants en supprimant et resaisissant la ligne correspondante.
                </p>
                <button className="flex items-center gap-2 text-secondary text-xs font-bold uppercase tracking-widest hover:translate-x-2 transition-transform">
                   Voir le rapport complet <ArrowRight size={14} />
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
