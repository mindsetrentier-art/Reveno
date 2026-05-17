import { Link, Outlet, useLocation } from 'react-router-dom';
import { Home, BarChart3, Sparkles, User, Bell, Wallet, Building2, ChevronDown, Plus } from 'lucide-react';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import { useCompany } from '../context/CompanyContext';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Copilot from './Copilot';
import WeatherWidget from './WeatherWidget';

export default function Layout() {
  const location = useLocation();
  const { companies, selectedCompany, setSelectedCompany, createCompany } = useCompany();
  const [showCompanySwitch, setShowCompanySwitch] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');

  const navItems = [
    { name: 'Tableau de bord', path: '/', icon: Home },
    { name: 'Revenus', path: '/revenue', icon: Wallet },
    { name: 'IA', path: '/ai', icon: Sparkles },
  ];

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) return;
    await createCompany(newCompanyName);
    setNewCompanyName('');
    setIsCreating(false);
  };

  return (
    <div className="min-h-screen bg-background text-on-background font-sans flex flex-col">
      {/* Header */}
      <header className="fixed top-0 z-50 w-full bg-surface/80 backdrop-blur-xl border-b border-outline-variant h-16 flex justify-between items-center px-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center">
               <Wallet size={18} className="text-on-primary-container" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-on-surface">Reveno <span className="text-secondary font-medium ml-1">AI</span></h1>
          </div>

          {/* Company Switcher */}
          <div className="relative border-l border-outline-variant pl-6">
            <button 
              onClick={() => setShowCompanySwitch(!showCompanySwitch)}
              className="flex items-center gap-2 hover:bg-[#F9F9F6] px-3 py-1.5 rounded-xl transition-all group"
            >
              <div className="w-6 h-6 bg-[#A3AD9F]/20 rounded-md flex items-center justify-center text-[#5A5A40]">
                <Building2 size={14} />
              </div>
              <span className="text-sm font-semibold">
                {selectedCompany?.name || 'Créer une entité'}
              </span>
              <ChevronDown size={14} className={cn("text-on-surface-variant transition-transform", showCompanySwitch && "rotate-180")} />
            </button>

            <AnimatePresence>
              {showCompanySwitch && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-6 mt-2 w-64 bg-white border border-outline-variant rounded-2xl shadow-xl p-2 z-50"
                >
                  <div className="max-h-48 overflow-y-auto">
                    {companies.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCompany(c);
                          setShowCompanySwitch(false);
                        }}
                        className={cn(
                          "w-full text-left px-4 py-2 rounded-xl text-sm transition-colors mb-1",
                          selectedCompany?.id === c.id ? "bg-primary-container text-white" : "hover:bg-surface text-on-surface-variant"
                        )}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                  
                  <div className="border-t border-outline-variant mt-2 pt-2">
                    {isCreating ? (
                      <div className="px-2 space-y-2">
                        <input 
                          autoFocus
                          placeholder="Nom de l'entité"
                          className="w-full text-xs p-2 bg-surface rounded-lg outline-none border border-primary-container/30"
                          value={newCompanyName}
                          onChange={(e) => setNewCompanyName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleCreateCompany()}
                        />
                        <div className="flex gap-2">
                          <button onClick={handleCreateCompany} className="flex-1 text-[10px] bg-primary-container text-white py-1 rounded-md">Créer</button>
                          <button onClick={() => setIsCreating(false)} className="flex-1 text-[10px] bg-surface py-1 rounded-md">Annuler</button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setIsCreating(true)}
                        className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-primary-container hover:bg-primary-container/5 transition-colors"
                      >
                        <Plus size={14} />
                        Nouvelle entité financière
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
      <main className="flex-grow pt-24 pb-32 px-6 max-w-7xl mx-auto w-full">
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
      <nav className="md:hidden fixed bottom-6 left-6 right-6 z-50 bg-surface/90 backdrop-blur-2xl border border-outline-variant rounded-2xl px-4 py-3 flex justify-around items-center shadow-xl">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center gap-1 transition-all duration-300 px-4 py-2 rounded-xl",
              location.pathname === item.path 
                ? "text-primary-container bg-primary-container/10" 
                : "text-on-surface-variant hover:text-primary-container"
            )}
          >
            <item.icon size={20} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{item.name}</span>
          </Link>
        ))}
        <button 
          className="flex flex-col items-center gap-1 text-on-surface-variant"
          onClick={() => auth.signOut()}
        >
          <User size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Profil</span>
        </button>
      </nav>
      {selectedCompany && <Copilot />}
      {selectedCompany && <WeatherWidget />}
    </div>
  );
}
