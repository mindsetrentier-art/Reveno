import { Link, Outlet, useLocation } from 'react-router-dom';
import React, { useState } from 'react';
import { Home, BarChart3, Sparkles, User, Bell, Wallet, Building2, ChevronDown, Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import { useCompany } from '../context/CompanyContext';
import { motion, AnimatePresence } from 'motion/react';
import Copilot from './Copilot';
import WeatherWidget from './WeatherWidget';

export default function Layout() {
  const location = useLocation();
  const { companies, selectedCompany, setSelectedCompany, createCompany, updateCompany, deleteCompany } = useCompany();
  const [showCompanySwitch, setShowCompanySwitch] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [editName, setEditName] = useState('');

  const navItems = [
    { name: 'Tableau de bord', path: '/', icon: Home },
    { name: 'Revenus', path: '/revenue', icon: Wallet },
    { name: 'Saisie', path: '/saisie', icon: BarChart3 },
    { name: 'IA', path: '/ai', icon: Sparkles },
  ];

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) return;
    await createCompany(newCompanyName);
    setNewCompanyName('');
    setIsCreating(false);
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    await updateCompany(id, editName);
    setEditingId(null);
    setEditName('');
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Voulez-vous vraiment supprimer cette entité ? Toutes les données associées seront inaccessibles.')) {
      await deleteCompany(id);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background font-sans flex flex-col">
      {/* Header */}
      <header className="fixed top-0 z-50 w-full bg-surface/80 backdrop-blur-xl border-b border-outline-variant h-16 flex justify-between items-center px-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center shrink-0">
               <Wallet size={18} className="text-on-primary-container" />
            </div>
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
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 sm:left-6 mt-2 w-screen sm:w-72 max-w-[calc(100vw-2rem)] bg-white border border-outline-variant rounded-2xl shadow-2xl p-2 z-50 overflow-hidden"
                >
                  <div className="max-h-80 overflow-y-auto space-y-1 p-1">
                    {companies.map((c) => (
                      <div key={c.id} className="relative group">
                        {editingId === c.id ? (
                          <div className="flex items-center gap-2 p-1 bg-surface rounded-xl">
                            <input 
                              autoFocus
                              className="flex-grow text-xs bg-transparent outline-none px-2 py-1"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleUpdate(c.id)}
                            />
                            <button onClick={() => handleUpdate(c.id)} className="p-1 hover:bg-green-100 text-green-600 rounded-lg">
                              <Check size={14} />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1 hover:bg-red-100 text-red-600 rounded-lg">
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
                                "flex-grow text-left px-4 py-2.5 rounded-xl text-sm transition-all",
                                selectedCompany?.id === c.id ? "bg-primary-container text-white" : "hover:bg-surface text-on-surface-variant"
                              )}
                            >
                              {c.name}
                            </button>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                                onClick={(e) => handleDelete(e, c.id)}
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
                  
                  <div className="border-t border-outline-variant mt-2 pt-2">
                    {isCreating ? (
                      <div className="p-2 bg-surface rounded-2xl space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest pl-1">Nouvelle Entité</label>
                          <input 
                            autoFocus
                            placeholder="Ex: Reveno Holding"
                            className="w-full text-sm p-3 bg-white border border-outline-variant rounded-xl outline-none focus:border-primary-container transition-all"
                            value={newCompanyName}
                            onChange={(e) => setNewCompanyName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateCompany()}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={handleCreateCompany} 
                            disabled={!newCompanyName.trim()}
                            className="flex-grow flex items-center justify-center gap-2 text-xs bg-primary-container text-white py-2.5 rounded-xl font-bold shadow-lg shadow-primary-container/20 disabled:opacity-50"
                          >
                            <Check size={14} /> Valider
                          </button>
                          <button 
                            onClick={() => setIsCreating(false)} 
                            className="p-2.5 bg-white border border-outline-variant rounded-xl text-on-surface-variant hover:bg-surface transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setIsCreating(true)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-primary-container hover:bg-primary-container/5 transition-colors group"
                      >
                        <div className="w-5 h-5 rounded-md bg-primary-container/10 flex items-center justify-center group-hover:bg-primary-container group-hover:text-white transition-all">
                          <Plus size={12} />
                        </div>
                        Ajouter une entité
                      </button>
                    )}
                  </div>
                </motion.div>
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
            <button className="p-2 rounded-full hover:bg-surface transition-colors relative">
              <Bell size={20} className="text-on-surface-variant" />
              <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-primary-container rounded-full border border-surface"></span>
            </button>
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
      <nav className="md:hidden fixed bottom-4 sm:bottom-6 left-4 sm:left-6 right-4 sm:left-6 z-40 bg-surface/90 backdrop-blur-2xl border border-outline-variant rounded-3xl px-2 py-2 flex justify-around items-center shadow-2xl">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center gap-1 transition-all duration-300 px-3 sm:px-4 py-2 rounded-2xl",
              location.pathname === item.path 
                ? "text-primary-container bg-primary-container/10 scale-105" 
                : "text-on-surface-variant hover:text-primary-container"
            )}
          >
            <item.icon size={22} />
            <span className="text-[9px] font-black uppercase tracking-tighter">{item.name}</span>
          </Link>
        ))}
      </nav>
      {selectedCompany && <Copilot />}
      {selectedCompany && <WeatherWidget />}
    </div>
  );
}
