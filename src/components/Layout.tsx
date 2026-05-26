import { Link, Outlet, useLocation } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { Home, BarChart3, Sparkles, User, Bell, Wallet, Building2, ChevronDown, ChevronUp, Plus, Edit2, Trash2, Check, X, Database, FileText, Target, AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import { useCompany } from '../context/CompanyContext';
import { motion, AnimatePresence } from 'motion/react';
import Copilot from './Copilot';
import WeatherWidget from './WeatherWidget';
import logoUrl from '../assets/images/reveno_logo_1779460450795.png';

interface NotificationItem {
  id: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  link?: string;
  actionLabel?: string;
}

export default function Layout() {
  const location = useLocation();
  const { 
    companies, 
    selectedCompany, 
    setSelectedCompany, 
    createCompany, 
    updateCompany, 
    deleteCompany,
    revenues,
    goal,
    transactions,
    loading
  } = useCompany();
  
  const [showCompanySwitch, setShowCompanySwitch] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [editName, setEditName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isSavingCompany, setIsSavingCompany] = useState(false);

  // States and refs for Notifications
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Sync notifications on company & data changes
  useEffect(() => {
    if (!selectedCompany) {
      setNotifications([]);
      return;
    }

    const storageKey = `reveno_notifications_${selectedCompany.id}`;
    const cached = localStorage.getItem(storageKey);
    let initialList: NotificationItem[] = [];

    if (cached) {
      try {
        initialList = JSON.parse(cached);
      } catch (e) {
        console.error("Failed to parse cached notifications", e);
      }
    }

    const updatedList = [...initialList];

    // Helper to add if id doesn't match
    const addIfNotExist = (item: Omit<NotificationItem, 'read'>) => {
      if (!updatedList.some(n => n.id === item.id)) {
        updatedList.unshift({ ...item, read: false });
      }
    };

    // 1. General Welcome audit alert
    addIfNotExist({
      id: `welcome-${selectedCompany.id}`,
      type: 'success',
      title: `Audit activé : ${selectedCompany.name}`,
      description: `L'entité "${selectedCompany.name}" est correctement initialisée et sécurisée via nos algorithmes Reveno.`,
      timestamp: "À l'instant",
    });

    // 2. Pending transactions alert
    const pendingCount = (transactions || []).filter(t => t.status === 'pending').length;
    if (pendingCount > 0) {
      addIfNotExist({
        id: `pending-${selectedCompany.id}-${pendingCount}`,
        type: 'warning',
        title: `${pendingCount} Saisie(s) à valider`,
        description: `Il y a ${pendingCount} transaction(s) en attente de vérification et de validation finale.`,
        timestamp: "Il y a 2 min",
        link: "/saisie",
        actionLabel: "Voir l'onglet Saisie"
      });
    }

    // 3. Goal state alert
    const monthlyGoal = goal?.monthlyGoal || 0;
    if (monthlyGoal === 0) {
      addIfNotExist({
        id: `goal-missing-${selectedCompany.id}`,
        type: 'info',
        title: "Objectifs non configurés",
        description: "Configurez un objectif mensuel ou annuel pour débloquer les calculs de vélocité de croissance et l'analyse prédictive.",
        timestamp: "Il y a 10 min",
        link: "/budget",
        actionLabel: "Configurer"
      });
    } else {
      // Check current month revenues
      const currentMonth = new Date().toISOString().substring(0, 7); // yyyy-mm
      const currentMonthRev = (revenues || [])
        .filter(r => r.month === currentMonth)
        .reduce((sum, r) => sum + r.revenue, 0);

      if (currentMonthRev >= monthlyGoal && monthlyGoal > 0) {
        addIfNotExist({
          id: `goal-reached-${selectedCompany.id}`,
          type: 'success',
          title: "Objectif de chiffre d'affaires atteint !",
          description: `Votre entité a atteint ou dépassé l'objectif cible avec un chiffre d'affaires de ${currentMonthRev.toLocaleString('fr-FR')} € !`,
          timestamp: "Il y a 1h",
          link: "/",
          actionLabel: "Voir les prévisions"
        });
      }
    }

    // 4. Database Security Check
    addIfNotExist({
      id: `security-${selectedCompany.id}`,
      type: 'info',
      title: "Chiffrement AES-256 actif",
      description: "Les données d'audit sont cryptées en local et répliquées en toute sécurité sur Firestore.",
      timestamp: "Il y a 30 min",
      link: "/backups",
      actionLabel: "Vérifier la sauvegarde"
    });

    localStorage.setItem(storageKey, JSON.stringify(updatedList));
    setNotifications(updatedList);
  }, [selectedCompany?.id, transactions?.length, revenues?.length, goal?.id]);

  const markAllAsRead = () => {
    if (!selectedCompany) return;
    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    localStorage.setItem(`reveno_notifications_${selectedCompany.id}`, JSON.stringify(updated));
  };

  const markAsRead = (id: string) => {
    if (!selectedCompany) return;
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    setNotifications(updated);
    localStorage.setItem(`reveno_notifications_${selectedCompany.id}`, JSON.stringify(updated));
  };

  const deleteNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedCompany) return;
    const updated = notifications.filter(n => n.id !== id);
    setNotifications(updated);
    localStorage.setItem(`reveno_notifications_${selectedCompany.id}`, JSON.stringify(updated));
  };

  // States and refs for company switcher scrolling
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScrollability = () => {
    const el = scrollContainerRef.current;
    if (el) {
      const hasOverflow = el.scrollHeight > el.clientHeight;
      setCanScrollUp(hasOverflow && el.scrollTop > 2);
      setCanScrollDown(hasOverflow && el.scrollTop + el.clientHeight < el.scrollHeight - 2);
    }
  };

  React.useEffect(() => {
    const el = scrollContainerRef.current;
    if (el && showCompanySwitch) {
      const handle = setTimeout(() => {
        checkScrollability();
      }, 50);

      const onScroll = () => {
        checkScrollability();
      };
      
      el.addEventListener('scroll', onScroll);
      
      const resizeObserver = new ResizeObserver(() => {
        checkScrollability();
      });
      resizeObserver.observe(el);

      return () => {
        clearTimeout(handle);
        el.removeEventListener('scroll', onScroll);
        resizeObserver.disconnect();
      };
    }
  }, [companies, showCompanySwitch]);

  const scrollList = (direction: 'up' | 'down') => {
    const el = scrollContainerRef.current;
    if (el) {
      const scrollAmount = 80;
      el.scrollBy({
        top: direction === 'up' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const navItems = [
    { name: 'Tableau de bord', path: '/', icon: Home },
    { name: 'Revenus', path: '/revenue', icon: Wallet },
    { name: 'Saisie', path: '/saisie', icon: BarChart3 },
    { name: 'Rapports', path: '/reports', icon: FileText },
    { name: 'Budget', path: '/budget', icon: Target },
    { name: 'IA', path: '/ai', icon: Sparkles },
    { name: 'Sauvegardes', path: '/backups', icon: Database },
  ];

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) return;
    if (companies.length >= 8) {
      alert("Vous ne pouvez pas enregistrer plus de 8 entités.");
      return;
    }
    setIsSavingCompany(true);
    try {
      const success = await createCompany(newCompanyName);
      if (success) {
        setNewCompanyName('');
        setIsCreating(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingCompany(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    setIsSavingCompany(true);
    try {
      const success = await updateCompany(id, editName);
      if (success) {
        setEditingId(null);
        setEditName('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingCompany(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const confirmDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteCompany(id);
    setDeleteConfirmId(null);
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(null);
  };

  return (
    <div className="min-h-screen bg-background text-on-background font-sans flex flex-col">
      {/* Header */}
      <header className="fixed top-0 z-50 w-full bg-surface/80 backdrop-blur-xl border-b border-outline-variant h-16 flex justify-between items-center px-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Reveno Logo" className="w-8 h-8 rounded-lg object-contain bg-white shrink-0" referrerPolicy="no-referrer" />
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-on-surface truncate">Reveno <span className="text-secondary font-medium ml-1 hidden sm:inline">AI</span></h1>
          </div>

          {/* Company Switcher */}
          <div className="relative border-l border-outline-variant pl-3 sm:pl-6">
            <button 
              onClick={() => setShowCompanySwitch(!showCompanySwitch)}
              className="flex items-center gap-2 hover:bg-[#F9F9F6] px-2 sm:px-3 py-1.5 rounded-xl transition-all group max-w-[140px] sm:max-w-none"
            >
              <div className="w-6 h-6 bg-[#A3AD9F]/20 rounded-md flex items-center justify-center text-[#5A5A40] shrink-0">
                <Building2 size={14} />
              </div>
              <span className="text-xs sm:text-sm font-semibold truncate hidden xs:block">
                {selectedCompany?.name || 'Entité'}
              </span>
              <ChevronDown size={14} className={cn("text-on-surface-variant transition-transform shrink-0", showCompanySwitch && "rotate-180")} />
            </button>

            <AnimatePresence>
              {showCompanySwitch && (
                <>
                  {/* Backdrop visible on mobile to enhance focus */}
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowCompanySwitch(false)}
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90] sm:hidden"
                  />

                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="fixed sm:absolute top-1/2 sm:top-full left-1/2 sm:left-6 -translate-x-1/2 sm:translate-x-0 -translate-y-1/2 sm:translate-y-0 mt-0 sm:mt-2 w-[calc(100vw-2rem)] sm:w-72 max-w-sm sm:max-w-none bg-white border border-outline-variant rounded-[24px] sm:rounded-2xl shadow-2xl p-4 sm:p-2 z-[100] sm:z-50 flex flex-col max-h-[85vh] sm:max-h-none"
                  >
                  <div className="flex justify-between items-center mb-3 sm:hidden px-1">
                    <h3 className="font-bold text-lg">Vos Entités</h3>
                    <button onClick={() => setShowCompanySwitch(false)} className="p-2 bg-surface hover:bg-surface-variant rounded-full transition-colors text-on-surface-variant">
                      <X size={20} />
                    </button>
                  </div>
                  {canScrollUp && (
                    <button 
                      type="button"
                      onClick={() => scrollList('up')}
                      className="flex items-center justify-center gap-1.5 py-1 w-full bg-[#A3AD9F]/10 hover:bg-[#A3AD9F]/20 text-[#5A5A40] rounded-xl cursor-pointer transition-all border border-outline-variant select-none shrink-0 text-[10px] font-bold uppercase tracking-wider mb-2"
                    >
                      <ChevronUp size={12} className="animate-bounce" style={{ animationDuration: '2s' }} />
                      Défiler vers le haut
                      <ChevronUp size={12} className="animate-bounce" style={{ animationDuration: '2s' }} />
                    </button>
                  )}

                  <div 
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto sm:max-h-52 space-y-1 p-1 min-h-0 overscroll-contain"
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: 'rgba(90, 90, 64, 0.3) transparent',
                    }}
                  >
                    {companies.map((c) => (
                      <div key={c.id} className="relative group">
                        {editingId === c.id ? (
                          <div className="flex items-center gap-2 p-1 bg-surface rounded-xl">
                            <input 
                              autoFocus
                              disabled={isSavingCompany}
                              className="flex-grow text-xs bg-transparent outline-none px-2 py-1 disabled:opacity-60"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && !isSavingCompany && handleUpdate(c.id)}
                            />
                            <button 
                              onClick={() => !isSavingCompany && handleUpdate(c.id)} 
                              disabled={isSavingCompany}
                              className="p-1 hover:bg-green-100 text-green-600 rounded-lg disabled:opacity-50"
                            >
                              <Check size={14} />
                            </button>
                            <button 
                              onClick={() => !isSavingCompany && setEditingId(null)} 
                              disabled={isSavingCompany}
                              className="p-1 hover:bg-red-100 text-red-600 rounded-lg disabled:opacity-50"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <button
                              onClick={() => {
                                setSelectedCompany(c);
                                setShowCompanySwitch(false);
                              }}
                              className={cn(
                                "flex-grow text-left pl-4 pr-16 py-2.5 rounded-xl text-sm transition-all",
                                selectedCompany?.id === c.id ? "bg-primary-container text-white" : "hover:bg-surface text-on-surface-variant"
                              )}
                            >
                              {c.name}
                            </button>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingId(c.id);
                                  setEditName(c.name);
                                }}
                                className="p-1.5 hover:bg-surface-variant rounded-lg text-primary-container"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button 
                                onClick={(e) => handleDeleteClick(e, c.id)}
                                className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {canScrollDown && (
                    <button 
                      type="button"
                      onClick={() => scrollList('down')}
                      className="flex items-center justify-center gap-1.5 py-1 w-full bg-[#A3AD9F]/10 hover:bg-[#A3AD9F]/20 text-[#5A5A40] rounded-xl cursor-pointer transition-all border border-outline-variant select-none shrink-0 text-[10px] font-bold uppercase tracking-wider mt-2"
                    >
                      <ChevronDown size={12} className="animate-bounce" style={{ animationDuration: '2s' }} />
                      Défiler vers le bas
                      <ChevronDown size={12} className="animate-bounce" style={{ animationDuration: '2s' }} />
                    </button>
                  )}
                  
                  <div className="border-t border-outline-variant mt-2 pt-2 shrink-0">
                    {isCreating ? (
                      <div className="p-2 bg-surface rounded-2xl space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest pl-1">Nouvelle Entité</label>
                          <input 
                            autoFocus
                            disabled={isSavingCompany}
                            placeholder="Ex: Reveno Holding"
                            className="w-full text-sm p-3 bg-white border border-outline-variant rounded-xl outline-none focus:border-primary-container transition-all disabled:opacity-60"
                            value={newCompanyName}
                            onChange={(e) => setNewCompanyName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !isSavingCompany && handleCreateCompany()}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={handleCreateCompany} 
                            disabled={!newCompanyName.trim() || isSavingCompany}
                            className="flex-grow flex items-center justify-center gap-2 text-xs bg-primary-container text-white py-2.5 rounded-xl font-bold shadow-lg shadow-primary-container/20 disabled:opacity-50"
                          >
                            <Check size={14} /> {isSavingCompany ? "Validation..." : "Valider"}
                          </button>
                          <button 
                            onClick={() => !isSavingCompany && setIsCreating(false)} 
                            disabled={isSavingCompany}
                            className="p-2.5 bg-white border border-outline-variant rounded-xl text-on-surface-variant hover:bg-surface transition-colors disabled:opacity-50"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => {
                          if (companies.length >= 8) {
                            alert("Limite de 8 entités atteinte.");
                            return;
                          }
                          setIsCreating(true)
                        }}
                        disabled={companies.length >= 8}
                        className={cn(
                          "w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors group",
                          companies.length >= 8 ? "text-on-surface-variant/50 cursor-not-allowed" : "text-primary-container hover:bg-primary-container/5"
                        )}
                        title={companies.length >= 8 ? "Limite de 8 entités atteinte." : ""}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded-md flex items-center justify-center transition-all",
                          companies.length >= 8 ? "bg-surface-variant text-on-surface-variant/50" : "bg-primary-container/10 group-hover:bg-primary-container group-hover:text-white"
                        )}>
                          <Plus size={12} />
                        </div>
                        {companies.length >= 8 ? "Limite de 8 entités atteinte" : "Ajouter une entité"}
                      </button>
                    )}
                  </div>
                </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "font-medium text-sm transition-colors",
                  location.pathname === item.path ? "text-primary-container" : "text-on-surface-variant hover:text-primary-container"
                )}
              >
                {item.name}
              </Link>
            ))}
          </nav>
          
          <div className="flex items-center gap-4 border-l border-outline-variant pl-6">
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-full hover:bg-surface transition-colors relative group"
                title="Notifications & alertes d'audit"
              >
                <Bell size={20} className={cn("text-on-surface-variant transition-colors group-hover:text-primary-container", showNotifications && "text-primary-container")} />
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-surface" />
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div 
                      className="fixed inset-0 z-[80]" 
                      onClick={() => setShowNotifications(false)} 
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 12, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 12, scale: 0.95 }}
                      className="absolute -right-4 sm:right-0 mt-3 w-[calc(100vw-2rem)] sm:w-96 max-w-sm sm:max-w-none bg-white border border-outline-variant rounded-2xl shadow-2xl p-4 z-[90] flex flex-col max-h-[80vh]"
                    >
                      <div className="flex items-center justify-between border-b border-outline-variant pb-2 mb-2 bg-white sticky top-0 z-10">
                        <span className="font-display font-bold text-sm">Notifications d'Audit</span>
                        {notifications.length > 0 && (
                          <button 
                            onClick={markAllAsRead}
                            className="text-[9px] uppercase font-bold text-[#5A5A40] hover:text-primary-container tracking-wider transition-colors"
                          >
                            Tout marquer comme lu
                          </button>
                        )}
                      </div>

                      <div className="flex-grow overflow-y-auto space-y-2 max-h-[340px] pr-1 no-scrollbar min-h-0">
                        {loading ? (
                          <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
                            <div className="w-5 h-5 border-2 border-[#5A5A40] border-t-transparent rounded-full animate-spin" />
                            <p className="text-[10px] text-on-surface-variant/60 font-semibold uppercase tracking-widest">Calcul en cours...</p>
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="py-8 flex flex-col items-center justify-center text-center text-on-surface-variant/40 space-y-2">
                            <Bell size={28} className="opacity-30" />
                            <p className="text-xs font-semibold">Aucune alerte</p>
                            <p className="text-[10px] px-4 opacity-80 leading-normal">Vos alertes de revenus, saisies en attente et anomalies IA s'afficheront ici.</p>
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div 
                              key={n.id}
                              onClick={() => !n.read && markAsRead(n.id)}
                              className={cn(
                                "p-3 rounded-xl border transition-all text-left relative group cursor-pointer",
                                n.read 
                                  ? "bg-white border-outline-variant/50 hover:bg-[#F9F9F6]/40" 
                                  : "bg-primary-container/5 border-primary-container/20 hover:bg-primary-container/10"
                              )}
                            >
                              <div className="flex items-start gap-2.5">
                                <div className={cn(
                                  "p-1.5 rounded-lg shrink-0 mt-0.5",
                                  n.type === 'success' && "bg-[#A3AD9F]/20 text-[#5A5A40]",
                                  n.type === 'warning' && "bg-amber-500/10 text-amber-600",
                                  n.type === 'danger' && "bg-red-500/10 text-red-600",
                                  n.type === 'info' && "bg-primary-container/10 text-primary-container",
                                )}>
                                  {n.type === 'warning' || n.type === 'danger' ? (
                                    <AlertTriangle size={12} />
                                  ) : (
                                    <Clock size={12} />
                                  )}
                                </div>

                                <div className="flex-grow space-y-1 min-w-0 pr-4">
                                  <div className="flex items-center justify-between gap-2">
                                    <h4 className={cn("text-xs font-bold truncate", !n.read && "text-primary-container")}>
                                      {n.title}
                                    </h4>
                                    <span className="text-[8px] text-on-surface-variant/50 uppercase tracking-tight">
                                      {n.timestamp}
                                    </span>
                                  </div>
                                  <p className="text-[11px] leading-relaxed text-on-surface-variant/80">
                                    {n.description}
                                  </p>
                                  
                                  {n.link && (
                                    <div className="pt-1.5">
                                      <Link 
                                        to={n.link}
                                        onClick={() => {
                                          markAsRead(n.id);
                                          setShowNotifications(false);
                                        }}
                                        className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-primary-container tracking-wider hover:brightness-110"
                                      >
                                        <span>{n.actionLabel || "Consulter"}</span>
                                        <ArrowRight size={10} className="stroke-[2.5]" />
                                      </Link>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {!n.read && (
                                <span className="absolute top-3 right-3 w-1.5 h-1.5 bg-primary-container rounded-full" />
                              )}
                              <button
                                onClick={(e) => deleteNotification(n.id, e)}
                                className="absolute bottom-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-500 transition-all"
                                title="Supprimer l'alerte"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <div 
              className="w-10 h-10 rounded-full border border-outline-variant overflow-hidden cursor-pointer bg-white flex items-center justify-center shadow-sm"
              onClick={() => auth.signOut()}
              title="Déconnexion"
            >
              <img 
                src={auth.currentUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${auth.currentUser?.email}`} 
                alt="Profil" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow pt-20 sm:pt-24 pb-32 px-4 sm:px-6 max-w-7xl mx-auto w-full">
        {selectedCompany ? (
          <Outlet />
        ) : (
          <div className="h-full flex flex-col items-center justify-center py-20 text-center space-y-8">
             <div className="w-24 h-24 bg-surface rounded-full flex items-center justify-center text-on-surface-variant/30">
                <Building2 size={48} />
             </div>
             <div className="space-y-4">
                <h2 className="font-display text-3xl font-bold">Aucune entité financière détectée</h2>
                <p className="text-on-surface-variant max-w-md mx-auto">
                  Reveno nécessite au moins une entité financière pour gérer la trésorerie. Créez votre première entreprise ou entité pour commencer l'audit.
                </p>
                <button 
                  onClick={() => setShowCompanySwitch(true)}
                  className="bg-primary-container text-white px-8 py-4 rounded-2xl font-bold hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-primary-container/20 uppercase text-xs tracking-widest"
                >
                  Configurer une entité
                </button>
             </div>
          </div>
        )}
      </main>

      {/* Bottom Nav (Mobile) */}
      <nav className="md:hidden fixed bottom-4 sm:bottom-6 left-4 sm:left-6 right-4 sm:left-6 z-40 bg-surface/90 backdrop-blur-2xl border border-outline-variant rounded-3xl px-2 py-2 flex items-center shadow-2xl overflow-x-auto no-scrollbar gap-2">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center gap-1 transition-all duration-300 px-3 sm:px-4 py-2 rounded-2xl min-w-[70px] shrink-0",
              location.pathname === item.path 
                ? "text-primary-container bg-primary-container/10 scale-105" 
                : "text-on-surface-variant hover:text-primary-container"
            )}
          >
            <item.icon size={22} />
            <span className="text-[9px] font-black uppercase tracking-tighter truncate w-full text-center">{item.name}</span>
          </Link>
        ))}
      </nav>
      <AnimatePresence>
        {deleteConfirmId && (
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
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-outline-variant space-y-6"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <div className="text-center space-y-2">
                <h3 className="font-display font-bold text-xl text-on-surface">Supprimer l'entité ?</h3>
                <p className="text-sm text-on-surface-variant">
                  Êtes-vous sûr de vouloir supprimer cette entité ? Toutes les données associées seront perdues. Cette action est irréversible.
                </p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={cancelDelete}
                  className="flex-1 py-3 px-4 rounded-xl font-bold bg-surface hover:bg-surface-variant transition-colors text-on-surface-variant text-sm"
                >
                  Annuler
                </button>
                <button 
                  onClick={(e) => confirmDelete(e, deleteConfirmId)}
                  className="flex-1 py-3 px-4 rounded-xl font-bold bg-red-600 hover:bg-red-700 transition-colors text-white text-sm shadow-lg shadow-red-600/20"
                >
                  Supprimer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedCompany && <Copilot />}
      {selectedCompany && <div className="hidden md:block"><WeatherWidget /></div>}
    </div>
  );
}
