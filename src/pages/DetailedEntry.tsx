import { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, deleteDoc, doc, updateDoc, writeBatch, getDocs } from 'firebase/firestore';
import { formatCurrency } from '../lib/utils';
import { useCompany } from '../context/CompanyContext';
import { backupData } from '../lib/backup';
import { encryptNumeric, decryptNumeric } from '../lib/encryption';
import { motion, AnimatePresence } from 'motion/react';
import { Save, Trash2, Plus, ArrowRight, History, Calculator, CheckCircle2, Edit2, X, Search, Filter as FilterIcon, ChevronDown, ChevronUp, CalendarSync } from 'lucide-react';
import { cn } from '../lib/utils';
import { googleSignIn, getAccessToken } from '../lib/firebase';
import { createCalendarEvent } from '../lib/googleCalendar';

import { CATEGORIES, MONTHS, YEARS } from '../constants';

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
  const { selectedCompany, detailedEntries: entries, loading: contextLoading } = useCompany();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Transaction Entity States
  const [transName, setTransName] = useState('');
  const [transType, setTransType] = useState<'income' | 'expense'>('expense');
  const [transDate, setTransDate] = useState(new Date().toISOString().split('T')[0]);
  const [isCreatingTrans, setIsCreatingTrans] = useState(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const loading = contextLoading;

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      // Search by month, year, or category IDs present in breakdown
      const monthSearch = entry.month.toLowerCase().includes(searchQuery.toLowerCase());
      const catSearch = Object.keys(entry.breakdown).some(catId => 
        CATEGORIES.find(c => c.id === catId)?.label.toLowerCase().includes(searchQuery.toLowerCase())
      );
      const matchesSearch = monthSearch || catSearch;

      const matchesMonth = filterMonth === 'all' || entry.month === filterMonth;
      const matchesYear = filterYear === 'all' || entry.year.toString() === filterYear;
      
      const matchesCategories = filterCategories.length === 0 || 
        filterCategories.some(catId => entry.breakdown[catId] !== undefined);

      return matchesSearch && matchesMonth && matchesYear && matchesCategories;
    });
  }, [entries, searchQuery, filterMonth, filterYear, filterCategories]);

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

  const handleSave = async () => {
    const { validateNumericInput } = await import('../lib/validation');
    
    if (!auth.currentUser || !selectedCompany) return;
    
    const numericBreakdown: Record<string, number> = {};
    let hasValidationError = false;

    (Object.entries(amounts) as [string, string][]).forEach(([key, val]) => {
      if (val.trim() === '') return;
      
      const validation = validateNumericInput(val);
      if (!validation.isValid) {
        alert(`${CATEGORIES.find(c => c.id === key)?.label}: ${validation.error}`);
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

    setIsSaving(true);
    try {
      const numericTotal = Object.values(numericBreakdown).reduce((a, b) => a + b, 0);
      const encryptedBreakdown: Record<string, string> = {};
      Object.entries(numericBreakdown).forEach(([key, val]) => {
        encryptedBreakdown[key] = encryptNumeric(val);
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
        await backupData('DETAILED_ENTRY_UPDATE', { ...entryData, id: editingId, breakdown: numericBreakdown, total: numericTotal });
        setEditingId(null);
      } else {
        entryData.date = serverTimestamp();
        await addDoc(collection(db, 'detailed_entries'), entryData);
        await backupData('DETAILED_ENTRY_CAPTURE', { ...entryData, breakdown: numericBreakdown, total: numericTotal });
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

  const handleDelete = async (id: string) => {
    if (!confirm('Voulez-vous supprimer cet enregistrement ?')) return;
    await deleteDoc(doc(db, 'detailed_entries', id));
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
        .map(([k, v]) => `- ${CATEGORIES.find(c => c.id === k)?.label}: ${formatCurrency(v as number)}`)
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
    if (!transName.trim()) {
      alert('Veuillez saisir un nom pour la transaction.');
      return;
    }

    setIsCreatingTrans(true);
    try {
      const transData = {
        name: transName,
        type: transType,
        date: new Date(transDate),
        userId: auth.currentUser.uid,
        companyId: selectedCompany.id,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'transactions'), transData);
      await backupData('TRANSACTION_CREATE', transData);
      
      setTransName('');
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
              <div className="flex items-center gap-3">
                <Calculator className="text-primary-container" size={24} />
                <h2 className="font-display font-bold text-xl">{editingId ? 'Modifier la Saisie' : 'Nouvelle Saisie'}</h2>
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
              {CATEGORIES.map((cat) => (
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
              {editingId && (
                <button 
                  onClick={handleCancelEdit}
                  className="flex-1 bg-white border border-outline-variant text-on-surface-variant py-5 rounded-2xl font-display font-bold uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 hover:bg-background transition-all"
                >
                  <X size={18} />
                  Annuler
                </button>
              )}
              <button 
                onClick={handleSave}
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
                          {CATEGORIES.map(cat => (
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
                  {CATEGORIES.map(cat => {
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
                        className={cn("h-full", CATEGORIES.find(c => c.id === cat.id)?.color?.startsWith('bg-') ? cat.color : `bg-[${cat.color}]`)}
                        title={`${cat.label}: ${formatCurrency(totalForCat)}`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
            
            <div className="divide-y divide-outline-variant max-h-[800px] overflow-y-auto">
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
                filteredEntries.map((entry) => (
                  <div key={entry.id} className="p-6 hover:bg-background transition-colors group">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary-container bg-primary-container/10 px-2 py-0.5 rounded-md">
                            {entry.month} {entry.year}
                          </p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                            {entry.date?.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        <p className="font-display font-bold text-xl">{formatCurrency(entry.total)}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
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
                          onClick={() => handleDelete(entry.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-xl"
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
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
