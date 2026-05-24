import { useState } from 'react';
import { googleSignIn } from '../lib/firebase';
import { Wallet, TrendingUp, ShieldCheck, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import logoUrl from '../assets/images/reveno_logo_1779460450795.png';

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await googleSignIn();
    } catch (error) {
      console.error('Login Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background relative overflow-hidden flex items-center justify-center p-6">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none dot-grid opacity-30"></div>

      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
        {/* Left Side: Brand & Visual */}
        <div className="hidden lg:flex flex-col space-y-12">
            <div className="space-y-6">
            <div className="flex items-center gap-4">
              <img src={logoUrl} alt="Reveno Logo" className="w-12 h-12 rounded-xl shadow-lg shadow-primary-container/20 object-contain bg-white" referrerPolicy="no-referrer" />
              <h1 className="font-display font-bold text-4xl tracking-tight text-on-surface">Reveno <span className="text-secondary font-medium ml-1">AI</span></h1>
            </div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-display text-5xl font-bold text-on-surface leading-tight tracking-tight"
            >
              Gestion de trésorerie de classe institutionnelle pour l'entreprise moderne.
            </motion.h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-outline-variant">
              <div className="p-3 bg-primary-container/10 rounded-xl text-primary-container w-fit mb-4">
                <TrendingUp size={24} />
              </div>
              <h3 className="font-display text-xl font-bold mb-1">Revenu Total</h3>
              <p className="text-on-surface-variant text-sm">142 500 € <span className="text-secondary font-bold">+12.4%</span></p>
            </div>
            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-outline-variant">
              <div className="p-3 bg-primary-container/10 rounded-xl text-primary-container w-fit mb-4">
                <ShieldCheck size={24} />
              </div>
              <h3 className="font-display text-xl font-bold mb-1">Nœud Sécurisé</h3>
              <p className="text-on-surface-variant text-sm text-[10px] uppercase font-bold tracking-widest leading-none">Connectivité Active</p>
            </div>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="flex flex-col items-center lg:items-end w-full">
          {/* Brand/Logo for Mobile (Hidden on Desktop because desktop shows it on the left) */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-4 mb-8 lg:hidden text-center"
          >
            <img 
              src={logoUrl} 
              alt="Reveno Logo" 
              className="w-16 h-16 rounded-[22px] shadow-xl shadow-primary-container/20 object-contain bg-white ring-4 ring-white" 
              referrerPolicy="no-referrer" 
            />
            <div className="space-y-1">
              <h1 className="font-display font-black text-4xl tracking-tight text-on-surface">
                Reveno <span className="text-secondary font-medium ml-1">AI</span>
              </h1>
              <p className="text-xs text-on-surface-variant font-medium uppercase tracking-widest bg-primary-container/10 text-[#5A5A40] px-3.5 py-1 rounded-full w-fit mx-auto">
                Gestion de Trésorerie
              </p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white/70 backdrop-blur-xl p-10 space-y-8 rounded-[40px] shadow-2xl border border-outline-variant"
          >
            <div className="space-y-2 text-center lg:text-left">
              <h2 className="font-display text-3xl font-bold text-on-surface tracking-tight">Bon retour</h2>
              <p className="text-on-surface-variant">Entrez vos identifiants pour accéder à votre trésorerie.</p>
            </div>

            <div className="space-y-4">
              <button 
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-4 bg-white text-[#0F172A] font-bold py-4 rounded-2xl hover:border-[#CBD5E1] transition-all active:scale-[0.98] border border-[#E2E8F0] shadow-sm disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin text-primary-container" size={24} />
                ) : (
                  <>
                    <img 
                      src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                      alt="Google" 
                      className="w-6 h-6"
                    />
                    Continuer avec Google
                  </>
                )}
              </button>
              
              <div className="relative flex items-center py-4">
                <div className="flex-grow border-t border-outline-variant"></div>
                <span className="flex-shrink mx-4 text-xs font-bold text-on-surface-variant/50 uppercase tracking-widest">ou terminal sécurisé</span>
                <div className="flex-grow border-t border-outline-variant"></div>
              </div>

              <button className="w-full bg-primary-container text-white font-bold py-4 rounded-2xl hover:brightness-110 transition-all shadow-lg shadow-primary-container/20 flex items-center justify-center gap-3">
                <ShieldCheck size={20} />
                Clé de Sécurité Matérielle
              </button>
            </div>

            <div className="text-center pt-4">
              <p className="text-sm text-on-surface-variant/70 font-sans opacity-70">
                Nouveau sur Reveno ? <a href="#" className="text-secondary font-bold hover:underline">Demander l'accès</a>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
