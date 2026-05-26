import { useState, useEffect, useMemo, Fragment } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, deleteDoc, doc, updateDoc, writeBatch, getDocs } from 'firebase/firestore';
import { formatCurrency } from '../lib/utils';
import { useCompany } from '../context/CompanyContext';
import { backupData } from '../lib/backup';
import { encryptNumeric, decryptNumeric } from '../lib/encryption';
import { motion, AnimatePresence } from 'motion/react';
import { Save, Trash2, Plus, ArrowRight, History, Calculator, CheckCircle2, Edit2, X, Search, Filter as FilterIcon, ChevronDown, ChevronUp, CalendarSync, ArrowUp, ArrowDown, RotateCcw, Camera, Mic } from 'lucide-react';

import { cn } from '../lib/utils';
import { googleSignIn, getAccessToken } from '../lib/firebase';
import { createCalendarEvent } from '../lib/googleCalendar';
import ReceiptScanner from '../components/ReceiptScanner';
import VoiceEntryCreator from '../components/VoiceEntryCreator';

import { MONTHS, YEARS } from '../constants';

interface DetailedEntryData {
  id: string;
  date: any;
  month: string;
  year: number;
  breakdown: Record<string, number>;
  total: number;
  userId: string;
  companyId: string;
  isEncrypted?: boolean;
}

export default function DetailedEntry() {
  const { selectedCompany, detailedEntries: entries, transactions, loading: contextLoading, categories, updateCategories, deleteDetailedEntry } = useCompany();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState<Record<string, number> | null>(null);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showVoiceEntry, setShowVoiceEntry] = useState(false);

  const handleScanResult = (result: {
    month: string;
    year: number;
    breakdown: Record<string, number>;
    total: number;
    merchant?: string;
  }) => {
    if (result.month) {
      const matchedMonth = MONTHS.find(m => m.toLowerCase() === result.month.toLowerCase()) || result.month;
      setSelectedMonth(matchedMonth);
    }
    if (result.year) {
      setSelectedYear(result.year);
    }
    
    setAmounts(prev => {
      const merged = { ...prev };
      Object.entries(result.breakdown).forEach(([catId, val]) => {
        if (categories.some(c => c.id === catId)) {
          merged[catId] = String(val);
        }
      });
      return merged;
    });

    if (result.merchant && result.total) {
      setTransName(`Achat ${result.merchant}`);
      setTransAmount(String(result.total));
    }
  };

  const handleVoiceResult = (result: {
    month: string;
    year: number;
    breakdown: Record<string, number>;
    total: number;
    explanation?: string;
    merchant?: string;
  }) => {
    if (result.month) {
      const matchedMonth = MONTHS.find(m => m.toLowerCase() === result.month.toLowerCase()) || result.month;
      setSelectedMonth(matchedMonth);
    }
    if (result.year) {
      setSelectedYear(result.year);
    }

    setAmounts(prev => {
      const merged = { ...prev };
      Object.entries(result.breakdown).forEach(([catId, val]) => {
        if (categories.some(c => c.id === catId)) {
          merged[catId] = String(val);
        }
      });
      return merged;
    });

    if (result.merchant && result.total) {
      setTransName(`Achat ${result.merchant}`);
      setTransAmount(String(result.total));
    }
  };

  // Transaction Entity States
  const [transName, setTransName] = useState('');
  const [transAmount, setTransAmount] = useState('');
  const [transType, setTransType] = useState<'income' | 'expense'>('expense');
  const [transDate, setTransDate] = useState(new Date().toISOString().split('T')[0]);
  const [isCreatingTrans, setIsCreatingTrans] = useState(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<'date' | 'total'>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const loading = contextLoading;

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      // Search by month, year, or category IDs present in breakdown
      const monthSearch = entry.month.toLowerCase().includes(searchQuery.toLowerCase());
      const catSearch = Object.keys(entry.breakdown).some(catId => 
        categories.find(c => c.id === catId)?.label.toLowerCase().includes(searchQuery.toLowerCase())
      );
      const matchesSearch = monthSearch || catSearch;

      const matchesMonth = filterMonth === 'all' || entry.month === filterMonth;
      const matchesYear = filterYear === 'all' || entry.year.toString() === filterYear;
      
      const matchesCategories = filterCategories.length === 0 || 
        filterCategories.some(catId => entry.breakdown[catId] !== undefined);

      return matchesSearch && matchesMonth && matchesYear && matchesCategories;
    }).sort((a, b) => {
      if (sortField === 'total') {
        return sortOrder === 'desc' ? b.total - a.total : a.total - b.total;
      }
      const dateA = a.date instanceof Date ? a.date.getTime() : (a.date?.toDate ? a.date.toDate().getTime() : 0);
      const dateB = b.date instanceof Date ? b.date.getTime() : (b.date?.toDate ? b.date.toDate().getTime() : 0);
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [entries, searchQuery, filterMonth, filterYear, filterCategories, sortField, sortOrder]);

  const filteredCategoryTotals = useMemo(() => {
    const grandTotal = filteredEntries.reduce((acc, entry) => acc + entry.total, 0);
    return categories.map(cat => {
      const total = filteredEntries.reduce((acc, entry) => acc + (entry.breakdown[cat.id] || 0), 0);
      return {
        ...cat,
        total,
        percentage: grandTotal > 0 ? (total / grandTotal) * 100 : 0
      };
    }).filter(cat => cat.total > 0);
  }, [filteredEntries, categories]);

  const toggleCategoryFilter = (catId: string) => {
    setFilterCategories(prev => 
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  // Draft Sync
  useEffect(() => {
    if (!editingId) {
      const saved = localStorage.getItem(`draft_entries_${selectedCompany?.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setAmounts(parsed.amounts || {});
          if (parsed.month) setSelectedMonth(parsed.month);
          if (parsed.year) setSelectedYear(parsed.year);
        } catch (e) {
          console.error("Draft restore error", e);
        }
      }
    }
  }, [selectedCompany, editingId]);

  useEffect(() => {
    if (!editingId && selectedCompany) {
      localStorage.setItem(`draft_entries_${selectedCompany.id}`, JSON.stringify({
        amounts,
        month: selectedMonth,
        year: selectedYear
      }));
    }
  }, [amounts, selectedMonth, selectedYear, selectedCompany, editingId]);

  const handleAmountChange = (id: string, value: string) => {
    setAmounts(prev => ({ ...prev, [id]: value }));
  };

  const calculateTotal = (): number => {
    return Object.keys(amounts).reduce<number>((acc, key) => acc + (parseFloat(amounts[key]) || 0), 0);
  };

  const handlePreSave = async () => {
    const { validateNumericInput } = await import('../lib/validation');
    
    if (!auth.currentUser || !selectedCompany) return;
    
    const numericBreakdown: Record<string, number> = {};
    let hasValidationError = false;

    (Object.entries(amounts) as [string, any][]).forEach(([key, val]) => {
      const stringVal = val === undefined || val === null ? '' : String(val).trim();
      if (stringVal === '') return;
      
      const validation = validateNumericInput(stringVal);
      if (!validation.isValid) {
        alert(`${categories.find(c => c.id === key)?.label}: ${validation.error}`);
        hasValidationError = true;
        return;
      }
      
      if (validation.numericValue > 0) {
        numericBreakdown[key] = validation.numericValue;
      }
    });

    if (hasValidationError) return;
    if (Object.keys(numericBreakdown).length === 0) {
      alert('Veuillez saisir au moins un montant valide.');
      return;
    }

    setPendingSaveData(numericBreakdown);
    setShowSaveConfirm(true);
  };

  const handleConfirmSave = async () => {
    if (!pendingSaveData || !auth.currentUser || !selectedCompany) return;
    
    setShowSaveConfirm(false);
    setIsSaving(true);
    try {
      const numericTotal = Object.values(pendingSaveData).reduce((a: any, b: any) => (a as number) + (b as number), 0) as number;
      const encryptedBreakdown: Record<string, string> = {};
      Object.entries(pendingSaveData).forEach(([key, val]) => {
        encryptedBreakdown[key] = encryptNumeric(val as number);
      });

      const entryData: any = {
        month: selectedMonth,
        year: selectedYear,
        breakdown: encryptedBreakdown,
        total: encryptNumeric(numericTotal),
        userId: auth.currentUser.uid,
        companyId: selectedCompany.id,
        isEncrypted: true
      };

      if (editingId) {
        await updateDoc(doc(db, 'detailed_entries', editingId), entryData);
        await backupData('DETAILED_ENTRY_UPDATE', { ...entryData, id: editingId, breakdown: pendingSaveData, total: numericTotal });
        setEditingId(null);
      } else {
        entryData.date = serverTimestamp();
        await addDoc(collection(db, 'detailed_entries'), entryData);
        await backupData('DETAILED_ENTRY_CAPTURE', { ...entryData, breakdown: pendingSaveData, total: numericTotal });
      }
      
      setAmounts({});
      try {
        localStorage.removeItem(`draft_entries_${selectedCompany?.id}`);
      } catch (e) {
        console.error("Draft clear error", e);
      }
      alert(editingId ? 'Saisie mise à jour avec succès.' : 'Saisie enregistrée avec succès.');
    } catch (error) {
      console.error('Save error:', error);
      alert('Une erreur est survenue lors de l\'enregistrement. Veuillez vérifier votre connexion.');
    } finally {
      setIsSaving(false);
      setPendingSaveData(null);
    }
  };

  const handleEdit = (entry: DetailedEntryData) => {
    setEditingId(entry.id);
    const newAmounts: Record<string, string> = {};
    Object.entries(entry.breakdown).forEach(([k, v]) => {
      newAmounts[k] = v.toString();
    });
    setAmounts(newAmounts);
    setSelectedMonth(entry.month);
    setSelectedYear(entry.year);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setAmounts({});
  };

  const handleResetForm = () => {
    const hasValues = Object.keys(amounts).length > 0 || 
                      selectedMonth !== MONTHS[new Date().getMonth()] || 
                      selectedYear !== new Date().getFullYear();
    if (hasValues) {
      if (!confirm("Voulez-vous vraiment réinitialiser le formulaire ? Tous les montants saisis et les brouillons locaux seront effacés.")) return;
    }
    setAmounts({});
    setSelectedMonth(MONTHS[new Date().getMonth()]);
    setSelectedYear(new Date().getFullYear());
    setEditingId(null);
    if (selectedCompany) {
      try {
        localStorage.removeItem(`draft_entries_${selectedCompany.id}`);
      } catch (e) {
        console.error("Draft clear error", e);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Voulez-vous supprimer cet enregistrement ?')) return;
    await deleteDetailedEntry(id);
  };

  const handleDeleteAll = async () => {
    if (!auth.currentUser || !selectedCompany) return;
    
    const confirmDelete = confirm(
      "DANGER: Voulez-vous vraiment supprimer TOUTES les entrées détaillées pour cette entreprise ? Cette action est irréversible."
    );
    
    if (!confirmDelete) return;

    try {
      const q = query(
        collection(db, 'detailed_entries'),
        where('userId', '==', auth.currentUser.uid),
        where('companyId', '==', selectedCompany.id)
      );
      
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        alert('Aucune entrée à supprimer.');
        return;
      }

      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      alert('Toutes les entrées ont été supprimées avec succès.');
    } catch (error) {
      console.error('Delete All error:', error);
      alert('Une erreur est survenue lors de la suppression massive.');
    }
  };

  const syncToCalendar = async (entry: DetailedEntryData) => {
    try {
      setIsSyncing(entry.id);
      
      let token = getAccessToken();
      if (!token) {
        const result = await googleSignIn();
        if (!result) return;
        token = result.accessToken;
      }

      // Format current breakdown for description
      const breakdownDesc = Object.entries(entry.breakdown)
        .map(([k, v]) => `- ${categories.find(c => c.id === k)?.label || k}: ${formatCurrency(v as number)}`)
        .join('\n');

      // Use entry date or default to 1st of its month
      const date = entry.date?.toDate ? entry.date.toDate() : new Date(entry.year, MONTHS.indexOf(entry.month), 1);
      const isoDate = date.toISOString().split('T')[0];

      await createCalendarEvent({
        summary: `Dépenses: ${entry.month} ${entry.year} (${selectedCompany?.name})`,
        description: `Détail des dépenses pour ${entry.month} ${entry.year} - Entité: ${selectedCompany?.name}.\nTotal: ${formatCurrency(entry.total)}\n\nRépartition:\n${breakdownDesc}`,
        start: { date: isoDate },
        end: { date: isoDate },
      });

      alert('Événement de dépenses ajouté au calendrier Google !');
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Erreur lors de la synchronisation avec le calendrier.");
    } finally {
      setIsSyncing(null);
    }
  };

  const handleCreateTransaction = async () => {
    if (!auth.currentUser || !selectedCompany) return;
    
    const { validateStringInput, validateNumericInput } = await import('../lib/validation');
    
    const nameValidation = validateStringInput(transName, 3, 50);
    if (!nameValidation.isValid) {
      alert(`Nom: ${nameValidation.error}`);
      return;
    }

    const amountValidation = validateNumericInput(transAmount);
    if (!amountValidation.isValid) {
      alert(`Montant: ${amountValidation.error}`);
      return;
    }

    setIsCreatingTrans(true);
    try {
      const transData = {
        name: transName,
        type: transType,
        amount: encryptNumeric(amountValidation.numericValue),
        status: 'pending',
        date: new Date(transDate),
        userId: auth.currentUser.uid,
        companyId: selectedCompany.id,
        isEncrypted: true,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'transactions'), transData);
      await backupData('TRANSACTION_CREATE', { ...transData, amount: amountValidation.numericValue });
      
      setTransName('');
      setTransAmount('');
      setTransType('expense');
      setTransDate(new Date().toISOString().split('T')[0]);
      
      alert('Entité de transaction créée avec succès.');
    } catch (error) {
      console.error('Transaction create error:', error);
      alert('Une erreur est survenue lors de la création de la transaction.');
    } finally {
      setIsCreatingTrans(false);
    }
  };

  const toggleTransactionStatus = async (transaction: any) => {
    try {
      const newStatus = transaction.status === 'validated' ? 'pending' : 'validated';
      await updateDoc(doc(db, 'transactions', transaction.id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Toggle status error:', error);
    }
  };

  const handleValidateAllPending = async () => {
    if (!auth.currentUser || !selectedCompany || !transactions) return;
    
    const pendingTransactions = transactions.filter(t => t.status === 'pending');
    if (pendingTransactions.length === 0) {
      alert('Aucune transaction en attente à valider.');
      return;
    }

    if (!confirm(`Voulez-vous valider les ${pendingTransactions.length} transactions en attente ?`)) return;

    try {
      const batch = writeBatch(db);
      pendingTransactions.forEach(t => {
        const transRef = doc(db, 'transactions', t.id);
        batch.update(transRef, {
          status: 'validated',
          updatedAt: serverTimestamp()
        });
      });

      await batch.commit();
      alert(`${pendingTransactions.length} transactions ont été validées.`);
    } catch (error) {
      console.error('Validate all error:', error);
      alert('Une erreur est survenue lors de la validation massive.');
    }
  };

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-10 border-b border-outline-variant pb-6">
        <section>
          <p className="text-secondary font-bold text-xs uppercase tracking-[0.2em] mb-2">Opérations Journalières</p>
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-on-surface">Saisie Détaillée</h1>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        {/* Entry Form */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-[32px] sm:rounded-[40px] border border-outline-variant shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-outline-variant flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface/50">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3">
                  <Calculator className="text-primary-container" size={24} />
                  <h2 className="font-display font-bold text-xl">{editingId ? 'Modifier la Saisie' : 'Nouvelle Saisie'}</h2>
                </div>
                {!editingId && (
                  <div className="flex items-center gap-2 mt-1.5 sm:mt-0 sm:ml-4">
                    <button
                      onClick={() => setShowScanner(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#5A5A40]/10 hover:bg-[#5A5A40]/15 text-[#5A5A40] rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                    >
                      <Camera size={11} /> Scanner Facture
                    </button>
                    <button
                      onClick={() => setShowVoiceEntry(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/15 text-primary rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                    >
                      <Mic size={11} /> Dicter
                    </button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-4 w-full sm:w-auto">
                <div className="flex-1 sm:flex-none text-left sm:text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Mois</p>
                  <select 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-transparent font-display font-bold text-sm text-primary-container outline-none appearance-none cursor-pointer border-b border-primary-container/20 sm:border-none pb-1 sm:pb-0"
                  >
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="flex-1 sm:flex-none text-left sm:text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Année</p>
                  <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="bg-transparent font-display font-bold text-sm text-primary-container outline-none appearance-none cursor-pointer border-b border-primary-container/20 sm:border-none pb-1 sm:pb-0"
                  >
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="w-full sm:w-auto text-right pl-0 sm:pl-4 border-l-0 sm:border-l border-outline-variant pt-2 sm:pt-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1 text-center sm:text-right">Total calculé</p>
                  <p className="font-display font-bold text-3xl sm:text-2xl text-primary-container text-center sm:text-right">{formatCurrency(calculateTotal())}</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 sm:p-8 space-y-4">
              <div className="flex justify-end mb-2">
                <button 
                  onClick={() => setShowManageCategories(true)}
                  className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-primary-container transition-colors"
                >
                  Gérer les modules
                </button>
              </div>
              {categories.map((cat) => (
                <div key={cat.id} className="group flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 p-4 rounded-2xl hover:bg-background transition-all border border-outline-variant sm:border-transparent hover:border-outline-variant bg-surface/30 sm:bg-transparent">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-2 h-8 sm:h-10 rounded-full shrink-0", cat.color)} />
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant sm:mb-1">
                      {cat.label}
                    </label>
                  </div>
                  <div className="flex-grow flex items-center gap-3">
                    <div className="relative flex-grow">
                       <input 
                         type="number"
                         placeholder="0.00"
                         value={amounts[cat.id] || ''}
                         onChange={(e) => handleAmountChange(cat.id, e.target.value)}
                         className="w-full bg-background/50 border border-outline-variant rounded-xl px-4 py-3 focus:outline-none focus:border-primary-container transition-all text-lg font-display font-bold"
                       />
                       <span className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold text-sm">€</span>
                    </div>
                    {amounts[cat.id] && parseFloat(amounts[cat.id]) > 0 && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="shrink-0">
                        <CheckCircle2 className="text-green-500" size={20} />
                      </motion.div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 sm:p-8 bg-surface/50 border-t border-outline-variant flex gap-4">
              {editingId ? (
                <button 
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex-1 bg-white border border-outline-variant text-on-surface-variant py-5 rounded-2xl font-display font-bold uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 hover:bg-background transition-all"
                >
                  <X size={18} />
                  Annuler
                </button>
              ) : (
                <button 
                  type="button"
                  onClick={handleResetForm}
                  className="flex-1 bg-white border border-outline-variant text-on-surface-variant py-5 rounded-2xl font-display font-bold uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 hover:bg-background transition-all"
                >
                  <RotateCcw size={18} />
                  Réinitialiser
                </button>
              )}
              <button 
                type="button"
                onClick={handlePreSave}
                disabled={isSaving || calculateTotal() === 0}
                className={cn(
                  "flex-[2] text-white py-5 rounded-2xl font-display font-bold uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl",
                  editingId ? "bg-secondary shadow-secondary/20" : "bg-primary-container shadow-primary-container/20"
                )}
              >
                {isSaving ? 'Traitement...' : (
                  <>
                    <Save size={18} />
                    {editingId ? 'Mettre à jour' : 'Sauvegarder la session'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-5 space-y-6">
          {/* Create Transaction Entity Section */}
          <div className="bg-white rounded-[40px] border border-outline-variant shadow-sm overflow-hidden h-fit">
            <div className="p-8 border-b border-outline-variant bg-surface/30">
              <div className="flex items-center gap-3">
                <Plus className="text-secondary" size={24} />
                <h2 className="font-display font-bold text-xl">Créer une Transaction</h2>
              </div>
              <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mt-1 opacity-60">Enregistrement d'entité générique</p>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Nom de la transaction</label>
                  <input 
                    type="text"
                    placeholder="Ex: Facture Amazon, Vente Client X..."
                    value={transName}
                    onChange={(e) => setTransName(e.target.value)}
                    className="w-full bg-background border border-outline-variant rounded-xl px-4 py-3 focus:outline-none focus:border-primary-container transition-all text-sm font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Montant (€)</label>
                  <input 
                    type="number"
                    placeholder="0.00"
                    value={transAmount}
                    onChange={(e) => setTransAmount(e.target.value)}
                    className="w-full bg-background border border-outline-variant rounded-xl px-4 py-3 focus:outline-none focus:border-primary-container transition-all text-sm font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Type</label>
                    <div className="flex bg-background p-1 rounded-xl border border-outline-variant">
                      <button 
                        onClick={() => setTransType('income')}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                          transType === 'income' ? "bg-green-500 text-white shadow-lg shadow-green-500/20" : "text-on-surface-variant hover:bg-surface"
                        )}
                      >
                        Revenu
                      </button>
                      <button 
                        onClick={() => setTransType('expense')}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                          transType === 'expense' ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "text-on-surface-variant hover:bg-surface"
                        )}
                      >
                        Dépense
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Date</label>
                    <input 
                      type="date"
                      value={transDate}
                      onChange={(e) => setTransDate(e.target.value)}
                      className="w-full bg-background border border-outline-variant rounded-xl px-4 py-2 focus:outline-none focus:border-primary-container transition-all text-sm font-medium"
                    />
                  </div>
                </div>
              </div>

              <button 
                onClick={handleCreateTransaction}
                disabled={isCreatingTrans || !transName.trim()}
                className="w-full bg-secondary text-white py-4 rounded-2xl font-display font-bold uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl shadow-secondary/20"
              >
                {isCreatingTrans ? 'Création...' : (
                  <>
                    <Plus size={18} />
                    Ajouter l'entité
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Transactions List */}
          <AnimatePresence>
            {transactions && transactions.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[40px] border border-outline-variant shadow-sm overflow-hidden"
              >
                <div className="p-8 border-b border-outline-variant bg-surface/30 flex items-center justify-between">
                  <h2 className="font-display font-bold text-xl">Dernières Transactions</h2>
                  {transactions.some(t => t.status === 'pending') && (
                    <button 
                      onClick={handleValidateAllPending}
                      className="flex items-center gap-2 px-4 py-1.5 bg-primary-container/10 text-primary-container border border-primary-container/20 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary-container hover:text-white transition-all shadow-sm"
                    >
                      <CheckCircle2 size={12} />
                      Valider tout
                    </button>
                  )}
                </div>
                <div className="divide-y divide-outline-variant max-h-[400px] overflow-y-auto">
                  {transactions.map(t => (
                    <div key={t.id} className="p-6 flex items-center justify-between hover:bg-background transition-colors group/item">
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => toggleTransactionStatus(t)}
                          className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold transition-all",
                            t.status === 'validated' 
                              ? (t.type === 'income' ? "bg-green-500 shadow-lg shadow-green-500/20" : "bg-red-500 shadow-lg shadow-red-500/20")
                              : "bg-outline-variant"
                          )}
                          title={t.status === 'validated' ? "Marquer comme en attente" : "Valider l'entité"}
                        >
                          {t.status === 'validated' ? <CheckCircle2 size={16} /> : <div className="w-2 h-2 rounded-full bg-white/50" />}
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                             <p className="font-bold text-sm">{t.name}</p>
                             <span className={cn(
                               "text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded",
                               t.status === 'validated' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                             )}>
                               {t.status === 'validated' ? 'Validé' : 'Attente'}
                             </span>
                          </div>
                          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
                            {t.date?.toDate ? t.date.toDate().toLocaleDateString('fr-FR') : new Date(t.date).toLocaleDateString('fr-FR')} • {formatCurrency(t.amount)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 lg:opacity-0 lg:group-hover/item:opacity-100 transition-opacity">
                        <button 
                          onClick={async () => {
                            if (confirm('Supprimer cette transaction ?')) {
                              await deleteDoc(doc(db, 'transactions', t.id));
                            }
                          }}
                          className="p-3 text-on-surface-variant hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* History */}
          <div className="bg-white rounded-[40px] border border-outline-variant shadow-sm overflow-hidden h-fit">
            <div className="p-8 border-b border-outline-variant space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <History className="text-secondary" size={24} />
                  <h2 className="font-display font-bold text-xl">Derniers Registres</h2>
                </div>
                <div className="flex flex-col items-end">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Total Période</p>
                  <p className="font-display font-bold text-lg text-primary-container">
                    {formatCurrency(filteredEntries.reduce((acc, curr) => acc + curr.total, 0))}
                  </p>
                </div>
              </div>

              {/* Advanced Search & Filter Controls */}
              <div className="space-y-4 pt-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-40" size={16} />
                  <input 
                    type="text"
                    placeholder="Rechercher par mois ou catégorie..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-outline-variant rounded-xl text-sm focus:outline-none focus:border-primary-container transition-colors"
                  />
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
                      showFilters || filterMonth !== 'all' || filterYear !== 'all' || filterCategories.length > 0
                        ? "bg-primary-container text-white border-primary-container"
                        : "bg-surface border-outline-variant text-on-surface-variant hover:bg-background"
                    )}
                  >
                    <FilterIcon size={14} />
                    Filtres Avancés
                    {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  
                  {(filterMonth !== 'all' || filterYear !== 'all' || filterCategories.length > 0 || searchQuery) && (
                    <button 
                      onClick={() => {
                        setSearchQuery('');
                        setFilterMonth('all');
                        setFilterYear('all');
                        setFilterCategories([]);
                      }}
                      className="text-[10px] font-bold uppercase tracking-widest text-secondary hover:underline"
                    >
                      Réinitialiser
                    </button>
                  )}
                </div>

                <AnimatePresence>
                  {showFilters && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-4 pt-2"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">Mois</label>
                          <select 
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                            className="w-full bg-background border border-outline-variant rounded-lg px-2 py-1.5 text-xs outline-none"
                          >
                            <option value="all">Tous les mois</option>
                            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">Année</label>
                          <select 
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                            className="w-full bg-background border border-outline-variant rounded-lg px-2 py-1.5 text-xs outline-none"
                          >
                            <option value="all">Toutes les années</option>
                            {YEARS.map(y => <option key={y} value={y.toString()}>{y}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">Catégories</label>
                        <div className="flex flex-wrap gap-1.5">
                          {categories.map(cat => (
                            <button
                              key={cat.id}
                              onClick={() => toggleCategoryFilter(cat.id)}
                              className={cn(
                                "px-2.5 py-1 rounded-full text-[9px] font-bold border transition-all",
                                filterCategories.includes(cat.id)
                                  ? "bg-primary-container text-white border-primary-container"
                                  : "bg-surface border-outline-variant text-on-surface-variant hover:bg-background"
                              )}
                            >
                              {cat.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-outline-variant">
                        <button 
                          onClick={handleDeleteAll}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-100 transition-colors"
                        >
                          <Trash2 size={14} />
                          Tout supprimer (DANGER)
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* History Bar Visualization */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  <span>Répartition Volume</span>
                  <span>{filteredEntries.length} Saisies filtrées</span>
                </div>
                <div className="h-3 w-full bg-background rounded-full overflow-hidden flex border border-outline-variant">
                  {categories.map(cat => {
                    const totalForCat = filteredEntries.reduce((acc, entry) => acc + (entry.breakdown[cat.id] || 0), 0);
                    const grandTotal = filteredEntries.reduce((acc, entry) => acc + entry.total, 0);
                    if (grandTotal === 0) return null;
                    const width = (totalForCat / grandTotal) * 100;
                    if (width < 1) return null;
                    return (
                      <motion.div 
                        key={cat.id}
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        className={cn("h-full", categories.find(c => c.id === cat.id)?.color?.startsWith('bg-') ? cat.color : `bg-[${cat.color}]`)}
                        title={`${cat.label}: ${formatCurrency(totalForCat)}`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
            
            <div className="max-h-[800px] overflow-y-auto">
              {loading ? (
                <div className="p-12 text-center animate-pulse text-on-surface-variant font-bold uppercase text-[10px] tracking-widest">
                  Chargement de l'historique...
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="p-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto text-on-surface-variant/20">
                    <Search size={32} />
                  </div>
                  <p className="text-on-surface-variant text-sm font-medium">Aucun résultat trouvé.</p>
                </div>
              ) : (
                <>
                  {/* Summary row/widget of active categories */}
                  {filteredCategoryTotals.length > 0 && (
                    <div className="p-6 sm:p-8 bg-surface/10 border-b border-outline-variant">
                      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse" />
                        Synthèse par Catégorie (Saisies Affichées)
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {filteredCategoryTotals.map((cat) => (
                          <motion.div
                            key={cat.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white border border-outline-variant hover:border-primary-container/30 rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 shadow-sm"
                          >
                            <div className="flex items-center gap-2 mb-2.5 min-w-0">
                              <div className={cn("w-2 h-2 rounded-full shrink-0", cat.color)} />
                              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider truncate">
                                {cat.label}
                              </span>
                            </div>
                            <div className="space-y-0.5">
                              <p className="font-display font-bold text-lg leading-tight text-primary-container">
                                {formatCurrency(cat.total)}
                              </p>
                              <p className="text-[9px] font-medium text-on-surface-variant/60">
                                {cat.percentage.toFixed(1)}% du total
                              </p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mobile Cards List View */}
                  <div className="sm:hidden divide-y divide-outline-variant relative z-10">
                    {filteredEntries.map((entry) => (
                      <div key={entry.id} className="p-5 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="inline-block px-2 py-0.5 bg-primary-container/10 text-primary-container text-[9px] font-black uppercase rounded-md tracking-widest border border-primary-container/15">
                              {entry.month} {entry.year}
                            </span>
                            <p className="text-[10px] text-on-surface-variant font-bold mt-1 uppercase tracking-wider">
                              {entry.date instanceof Date ? entry.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : (entry.date?.toDate ? entry.date.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '')}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => syncToCalendar(entry)}
                              disabled={!!isSyncing}
                              className={cn(
                                "p-2 rounded-xl transition-colors",
                                isSyncing === entry.id ? "bg-primary-container/10 text-primary-container opacity-50" : "text-primary-container bg-primary-container/10 hover:bg-primary-container/20"
                              )}
                              title="Synchroniser Google Calendar"
                            >
                              <CalendarSync size={16} className={isSyncing === entry.id ? "animate-spin" : ""} />
                            </button>
                            <button 
                              onClick={() => handleEdit(entry)}
                              className="p-2 text-primary-container bg-primary-container/10 rounded-xl"
                              title="Modifier"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => deleteDetailedEntry(entry.id)}
                              className="p-2 text-red-500 bg-red-50 rounded-xl"
                              title="Supprimer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        
                        <div className="bg-surface/50 p-4 rounded-2xl space-y-3 border border-outline-variant/40">
                          <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Total Saisie</p>
                            <p className="font-display font-bold text-lg text-primary-container">{formatCurrency(entry.total)}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(Object.entries(entry.breakdown) as [string, number][]).map(([key, val]) => (
                              <div key={key} className="bg-white border border-outline-variant/50 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                                <div className={cn("w-1.5 h-1.5 rounded-full", categories.find(c => c.id === key)?.color || 'bg-gray-400')} />
                                <span className="text-[8px] font-bold text-on-surface-variant uppercase tracking-tighter">
                                  {(categories.find(c => c.id === key)?.label || key)}: {formatCurrency(val)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-white z-10 shadow-sm">
                        <tr className="bg-surface/50 border-b border-outline-variant">
                          <th 
                            onClick={() => { setSortField('date'); setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); }}
                            className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant cursor-pointer hover:bg-surface-variant transition-colors"
                          >
                            <div className="flex items-center gap-1">Date {sortField === 'date' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</div>
                          </th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Mois</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Année</th>
                          <th 
                            onClick={() => { setSortField('total'); setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); }}
                            className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant cursor-pointer hover:bg-surface-variant transition-colors"
                          >
                            <div className="flex items-center justify-end gap-1">Total {sortField === 'total' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</div>
                          </th>
                          <th className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant">
                        {filteredEntries.map((entry) => (
                          <Fragment key={entry.id}>
                            <tr className="hover:bg-background transition-colors group">
                              <td className="px-6 py-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                                  {entry.date instanceof Date ? entry.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : (entry.date?.toDate ? entry.date.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '')}
                                </p>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary-container bg-primary-container/10 px-2 py-0.5 rounded-md inline-block">
                                  {entry.month}
                                </p>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                                  {entry.year}
                                </p>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <p className="font-display font-bold text-sm text-primary-container">{formatCurrency(entry.total)}</p>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-center gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-all">
                                  <button 
                                    onClick={() => syncToCalendar(entry)}
                                    disabled={!!isSyncing}
                                    className={cn(
                                      "p-2 rounded-xl transition-colors",
                                      isSyncing === entry.id ? "text-primary-container opacity-50" : "text-primary-container hover:bg-primary-container/10"
                                    )}
                                    title="Synchroniser Google Calendar"
                                  >
                                    <CalendarSync size={16} className={isSyncing === entry.id ? "animate-spin" : ""} />
                                  </button>
                                  <button 
                                    onClick={() => handleEdit(entry)}
                                    className="p-2 text-primary-container hover:bg-primary-container/10 rounded-xl"
                                    title="Modifier"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button 
                                    onClick={() => deleteDetailedEntry(entry.id)}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl"
                                    title="Supprimer"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            <tr className="bg-surface/10 hover:bg-surface/20 transition-colors">
                              <td colSpan={5} className="px-6 pb-4 pt-1">
                                <div className="flex flex-wrap gap-2">
                                  {(Object.entries(entry.breakdown) as [string, number][]).map(([key, val]) => (
                                    <div key={key} className="bg-white border border-outline-variant px-3 py-1 rounded-lg flex items-center gap-2">
                                      <div className={cn("w-1.5 h-1.5 rounded-full", categories.find(c => c.id === key)?.color || 'bg-gray-400')} />
                                      <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-tighter">
                                        {(categories.find(c => c.id === key)?.id || key).toUpperCase()}: {formatCurrency(val)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
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

      <AnimatePresence>
        {showSaveConfirm && pendingSaveData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] p-6 sm:p-8 max-w-md w-full shadow-2xl border border-outline-variant space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="w-16 h-16 bg-primary-container/10 text-primary-container rounded-full flex items-center justify-center mx-auto mb-2">
                <Calculator size={32} />
              </div>
              
              <div className="text-center space-y-2">
                <h3 className="font-display font-bold text-2xl text-on-surface">
                  {editingId ? "Confirmer la mise à jour" : "Confirmer l'enregistrement"}
                </h3>
                <p className="text-xs font-bold uppercase tracking-widest text-primary-container bg-primary-container/5 px-3 py-1.5 rounded-full inline-block">
                  Période : {selectedMonth} {selectedYear}
                </p>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Veuillez vérifier les montants ci-dessous avant d'enregistrer la session d'entité.
                </p>
              </div>

              {/* breakdown */}
              <div className="bg-background border border-outline-variant rounded-2xl p-4 space-y-3 col-span-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant pb-2">
                  Détail par catégorie
                </p>
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {Object.entries(pendingSaveData).map(([key, val]) => {
                    const category = categories.find(c => c.id === key);
                    return (
                      <div key={key} className="flex items-center justify-between py-1 text-sm">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full shrink-0", category?.color || "bg-outline-variant")} />
                          <span className="font-medium text-on-surface-variant text-xs">{category?.label || key}</span>
                        </div>
                        <span className="font-display font-bold text-on-surface">{formatCurrency(val as number)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-outline-variant pt-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-on-surface-variant">Total cumulé</span>
                  <span className="font-display font-bold text-xl text-primary-container">
                    {formatCurrency(Object.values(pendingSaveData).reduce((a: any, b: any) => (a as number) + (b as number), 0) as number)}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowSaveConfirm(false);
                    setPendingSaveData(null);
                  }}
                  className="flex-1 py-4 px-4 rounded-xl font-bold bg-surface hover:bg-surface-variant transition-colors text-on-surface-variant text-sm border border-outline-variant"
                >
                  Modifier
                </button>
                <button
                  onClick={handleConfirmSave}
                  className="flex-1 py-4 px-4 rounded-xl font-bold bg-primary-container hover:brightness-110 transition-all text-white text-sm shadow-lg shadow-primary-container/20"
                >
                  Enregistrer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showScanner && (
        <ReceiptScanner
          categories={categories}
          onScanResult={handleScanResult}
          onClose={() => setShowScanner(false)}
        />
      )}

      {showVoiceEntry && (
        <VoiceEntryCreator
          categories={categories}
          onVoiceResult={handleVoiceResult}
          onClose={() => setShowVoiceEntry(false)}
        />
      )}

      <ManageCategoriesModal 
        isOpen={showManageCategories} 
        onClose={() => setShowManageCategories(false)} 
        categories={categories} 
        updateCategories={updateCategories}
      />

      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed sm:bottom-8 bottom-28 right-6 sm:right-8 w-14 h-14 bg-primary-container text-white rounded-full shadow-lg shadow-primary-container/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40 group"
        title="Nouvelle saisie"
      >
        <Plus size={24} className="group-hover:rotate-90 transition-transform duration-300" />
      </button>
    </div>
  );
}

function ManageCategoriesModal({ isOpen, onClose, categories, updateCategories }: any) {
  const [localCategories, setLocalCategories] = useState<any[]>(categories);

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories, isOpen]);

  if (!isOpen) return null;

  const handleUpdate = (idx: number, field: string, value: string) => {
    const updated = [...localCategories];
    updated[idx] = { ...updated[idx], [field]: value };
    setLocalCategories(updated);
  };

  const handleRemove = (idx: number) => {
    const updated = localCategories.filter((_, i) => i !== idx);
    setLocalCategories(updated);
  };

  const handleAdd = () => {
    setLocalCategories([...localCategories, { id: `cat_${Date.now()}`, label: 'Nouveau Module', color: '#888888' }]);
  };

  const handleSave = () => {
    // Only accept categories with labels and IDs
    const cleaned = localCategories.filter(c => c.label.trim() !== '');
    updateCategories(cleaned);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-[32px] p-6 max-w-lg w-full shadow-2xl border border-outline-variant max-h-[90vh] overflow-hidden flex flex-col">
        <h2 className="font-display font-bold text-2xl mb-4">Gérer les modules</h2>
        <div className="overflow-y-auto space-y-4 pr-2 flex-grow">
          {localCategories.map((c, i) => (
            <div key={c.id} className="flex items-center gap-3 bg-surface p-3 rounded-2xl">
               <input 
                 type="color" 
                 value={c.color} 
                 onChange={(e) => handleUpdate(i, 'color', e.target.value)}
                 className="w-8 h-8 rounded-full border-none outline-none cursor-pointer p-0 bg-transparent shrink-0" 
               />
               <input 
                 type="text" 
                 value={c.label} 
                 onChange={(e) => handleUpdate(i, 'label', e.target.value)}
                 className="flex-grow bg-white border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-container"
                 placeholder="Nom du module"
               />
               <button onClick={() => handleRemove(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                 <X size={18} />
               </button>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-outline-variant space-y-3 shrink-0">
          <button 
            onClick={handleAdd}
            className="w-full py-3 bg-surface border border-outline-variant border-dashed rounded-xl text-on-surface-variant text-sm font-bold uppercase tracking-widest hover:bg-background transition-colors"
          >
            + Ajouter un module
          </button>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-3 text-sm font-bold text-on-surface-variant hover:bg-surface rounded-xl">Annuler</button>
            <button onClick={handleSave} className="flex-1 py-3 bg-primary-container text-white text-sm font-bold rounded-xl shadow-lg shadow-primary-container/30 hover:scale-[1.02] active:scale-[0.98] transition-all">Enregistrer</button>
          </div>
        </div>
      </div>
    </div>
  );
}
