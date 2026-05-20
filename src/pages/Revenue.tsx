import { useState, useEffect, useMemo } from 'react';
import { useRevenueData } from '../hooks/useFinance';
import { formatCurrency, downloadCSV } from '../lib/utils';
import { exportToPDF } from '../lib/pdfExport';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Plus, Trash2, Edit2, X, Check, Filter, Download, Search, Calendar, CalendarSync, FileText, ArrowUp, ArrowDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { encryptNumeric } from '../lib/encryption';
import { useCompany } from '../context/CompanyContext';
import { backupData } from '../lib/backup';
import { cn } from '../lib/utils';
import { googleSignIn, getAccessToken } from '../lib/firebase';
import { createCalendarEvent } from '../lib/googleCalendar';
import { MONTHS } from '../constants';

export default function Revenue() {
  const { selectedCompany, revenues, loading } = useCompany();
  const [isAdding, setIsAdding] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newMonth, setNewMonth] = useState('');
  const [newAmount, setNewAmount] = useState('');

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<'date' | 'revenue'>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Derived Years for Filter
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    revenues.forEach(r => {
      // Assuming r.createdAt might have year or parsing month
      // For now, let's just use current and past 2 years if no date in data
      // Better: if r.createdAt exists, extract year
      if (r.createdAt) {
        const date = r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
        years.add(date.getFullYear().toString());
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [revenues]);

  const filteredRevenues = useMemo(() => {
    return revenues.filter(rev => {
      const matchesSearch = rev.month.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesYear = true;
      if (selectedYear !== 'all' && rev.createdAt) {
        const date = rev.createdAt.toDate ? rev.createdAt.toDate() : new Date(rev.createdAt);
        matchesYear = date.getFullYear().toString() === selectedYear;
      }
      
      return matchesSearch && matchesYear;
    }).sort((a, b) => {
      if (sortField === 'revenue') {
        return sortOrder === 'desc' ? b.revenue - a.revenue : a.revenue - b.revenue;
      }
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [revenues, searchQuery, selectedYear, sortField, sortOrder]);

  // Draft System
  useEffect(() => {
    if (!isAdding && !editingId) {
      const savedMonth = localStorage.getItem('revenue_draft_month');
      const savedAmount = localStorage.getItem('revenue_draft_amount');
      if (savedMonth) setNewMonth(savedMonth);
      if (savedAmount) setNewAmount(savedAmount);
    }
  }, []);

  useEffect(() => {
    if (isAdding || editingId) {
      localStorage.setItem('revenue_draft_month', newMonth);
      localStorage.setItem('revenue_draft_amount', newAmount);
    }
  }, [newMonth, newAmount, isAdding, editingId]);

  const handleExport = () => {
    if (filteredRevenues.length === 0) return;
    
    const exportData = filteredRevenues.map(r => ({
      'Mois': r.month,
      'Revenu': r.revenue,
      'Statut': 'Réglé',
      'Entité': selectedCompany?.name || 'Inconnue'
    }));
    
    downloadCSV(exportData, `${selectedCompany?.name || 'Reveno'}_Export_Revenus.csv`);
  };

  const syncToCalendar = async (rev: any) => {
    try {
      setIsSyncing(rev.id);
      
      let token = getAccessToken();
      if (!token) {
        const result = await googleSignIn();
        if (!result) return;
        token = result.accessToken;
      }

      // Prepare event date
      // We use the month from the revenue and the year from createdAt or current year
      const monthIdx = MONTHS.indexOf(rev.month);
      const year = rev.createdAt?.toDate ? rev.createdAt.toDate().getFullYear() : new Date().getFullYear();
      
      // Default to 15th of the month
      const eventDate = new Date(year, monthIdx, 15).toISOString().split('T')[0];

      await createCalendarEvent({
        summary: `Revenu: ${rev.month} (${selectedCompany?.name})`,
        description: `Enregistrement du revenu pour ${rev.month} - Entité: ${selectedCompany?.name}. Montant: ${formatCurrency(rev.revenue)}`,
        start: { date: eventDate },
        end: { date: eventDate },
      });

      alert('Événement ajouté au calendrier Google !');
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Erreur lors de la synchronisation avec le calendrier.");
    } finally {
      setIsSyncing(null);
    }
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
      const revenueData: any = {
        month: newMonth,
        revenue: encryptNumeric(numericRevenue),
        userId: auth.currentUser.uid,
        companyId: selectedCompany.id,
        isEncrypted: true
      };

      if (editingId) {
        await updateDoc(doc(db, 'revenues', editingId), revenueData);
        await backupData('REVENUE_UPDATE', { ...revenueData, id: editingId, revenue: numericRevenue });
        setEditingId(null);
      } else {
        revenueData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'revenues'), revenueData);
        await backupData('REVENUE_CAPTURE', { ...revenueData, revenue: numericRevenue });
      }

      setIsAdding(false);
      setNewMonth('');
      setNewAmount('');
      localStorage.removeItem('revenue_draft_month');
      localStorage.removeItem('revenue_draft_amount');
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement du revenu.");
    }
  };

  const handleEdit = (rev: any) => {
    setEditingId(rev.id);
    setNewMonth(rev.month);
    setNewAmount(rev.revenue.toString());
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Voulez-vous vraiment supprimer cet enregistrement institutionnel ?')) return;
    try {
      await deleteDoc(doc(db, 'revenues', id));
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la suppression.");
    }
  };

  return (
    <div id="revenue-report-content" className="space-y-8 bg-background pb-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <p className="text-secondary font-bold text-xs uppercase tracking-[0.2em] mb-2">Gestion de Trésorerie</p>
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-on-surface leading-tight">Suivi des revenus</h1>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap gap-3 items-center">
          <div className="relative flex-grow sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-40" size={16} />
            <input 
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white border border-outline-variant rounded-xl text-sm focus:outline-none focus:border-primary-container transition-colors w-full sm:w-64"
            />
          </div>
          <div className="flex gap-3 flex-grow sm:flex-grow-0">
            <div className="relative">
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "p-3 rounded-xl transition-all shadow-sm flex items-center justify-center border",
                  showFilters || selectedYear !== 'all' 
                    ? "bg-primary-container text-white border-primary-container" 
                    : "bg-white border-outline-variant text-on-surface-variant hover:text-primary-container"
                )}
              >
                <Filter size={18} />
              </button>
              
              <AnimatePresence>
                {showFilters && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-48 bg-white border border-outline-variant rounded-2xl shadow-xl p-4 z-50 space-y-3"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Filtrer par année</p>
                    <div className="space-y-1">
                      <button 
                        onClick={() => { setSelectedYear('all'); setShowFilters(false); }}
                        className={cn("w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors", selectedYear === 'all' ? "bg-primary-container/10 text-primary-container font-bold" : "hover:bg-background")}
                      >
                        Toutes les années
                      </button>
                      {availableYears.map(year => (
                        <button 
                          key={year}
                          onClick={() => { setSelectedYear(year); setShowFilters(false); }}
                          className={cn("w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors", selectedYear === year ? "bg-primary-container/10 text-primary-container font-bold" : "hover:bg-background")}
                        >
                          {year}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button 
              onClick={() => exportToPDF('revenue-report-content', `Revenus_${selectedCompany?.name || 'Reveno'}`.replace(/\s+/g, '_'))}
              className="flex-grow sm:flex-none p-3 bg-white border border-outline-variant rounded-xl text-on-surface-variant hover:text-primary-container transition-colors shadow-sm flex items-center justify-center"
              title="Exporter PDF"
            >
              <FileText size={18} />
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
            <span className="hidden xs:inline">Ajouter</span>
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
                className={cn(
                  "flex-grow flex items-center justify-center gap-2 text-white font-bold py-3 rounded-xl uppercase text-xs tracking-widest hover:brightness-110 transition-all",
                  editingId ? "bg-secondary" : "bg-primary-container"
                )}
              >
                <Check size={18} />
                {editingId ? 'Mettre à jour' : 'Confirmer'}
              </button>
              <button 
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                  setNewMonth('');
                  setNewAmount('');
                  localStorage.removeItem('revenue_draft_month');
                  localStorage.removeItem('revenue_draft_amount');
                }}
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
          ) : filteredRevenues.length === 0 ? (
            <div className="p-12 text-center text-on-surface-variant opacity-70">
              {searchQuery || selectedYear !== 'all' ? 'Aucun résultat pour cette recherche.' : 'Aucune donnée.'}
            </div>
          ) : (
            filteredRevenues.map((rev) => (
              <div key={rev.id} className="p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-bold font-display text-lg">Revenu de {rev.month}</h5>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-secondary/10 text-secondary text-[9px] font-black uppercase rounded-md tracking-widest border border-secondary/15">Réglé</span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => syncToCalendar(rev)}
                      disabled={!!isSyncing}
                      className={cn(
                        "p-2 rounded-xl transition-colors",
                        isSyncing === rev.id ? "bg-primary-container/10 text-primary-container opacity-50" : "text-primary-container bg-primary-container/10 hover:bg-primary-container/20"
                      )}
                      title="Synchroniser Google Calendar"
                    >
                      <CalendarSync size={16} className={isSyncing === rev.id ? "animate-spin" : ""} />
                    </button>
                    <button 
                      onClick={() => handleEdit(rev)}
                      className="p-2 text-primary-container bg-primary-container/10 rounded-xl"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(rev.id)}
                      className="p-2 text-red-500 bg-red-50 rounded-xl"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
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
                <th 
                  onClick={() => { setSortField('date'); setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); }}
                  className="px-8 py-5 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em] cursor-pointer hover:bg-surface-variant transition-colors"
                >
                  <div className="flex items-center gap-1">Période de Rapport {sortField === 'date' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</div>
                </th>
                <th 
                  onClick={() => { setSortField('revenue'); setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); }}
                  className="px-8 py-5 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em] text-right cursor-pointer hover:bg-surface-variant transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">Flux de Revenus {sortField === 'revenue' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</div>
                </th>
                <th className="px-8 py-5 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em] text-center">Statut Audit</th>
                <th className="px-8 py-5 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant text-sm">
              {loading ? (
                <tr><td colSpan={4} className="p-12 text-center animate-pulse opacity-70 text-on-surface-variant">Accès aux registres institutionnels...</td></tr>
              ) : filteredRevenues.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-on-surface-variant opacity-70">
                    {searchQuery || selectedYear !== 'all' 
                      ? 'Aucun résultat ne correspond à vos critères de recherche.' 
                      : 'Trésorerie vide. Initialisez les enregistrements pour générer des données de performance.'}
                  </td>
                </tr>
              ) : (
                filteredRevenues.map((rev) => (
                  <tr key={rev.id} className="hover:bg-background transition-colors group">
                    <td className="px-8 py-6 font-display text-lg font-bold truncate max-w-[200px]">Revenu de {rev.month}</td>
                    <td className="px-8 py-6 text-right font-display font-bold text-xl">{formatCurrency(rev.revenue)}</td>
                    <td className="px-8 py-6 text-center">
                       <span className="px-3 py-1 bg-secondary/10 text-secondary text-[10px] font-bold uppercase rounded-full tracking-widest border border-secondary/20">Réglé</span>
                    </td>
                    <td className="px-8 py-6 text-right">
                       <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => syncToCalendar(rev)}
                            disabled={!!isSyncing}
                            className={cn(
                              "p-2 transition-colors",
                              isSyncing === rev.id ? "text-primary-container opacity-50" : "text-on-surface-variant hover:text-primary-container"
                            )}
                            title="Synchroniser Google Calendar"
                          >
                            <CalendarSync size={16} className={isSyncing === rev.id ? "animate-spin" : ""} />
                          </button>
                          <button 
                            onClick={() => handleEdit(rev)}
                            className="p-2 text-on-surface-variant hover:text-primary-container transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
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
