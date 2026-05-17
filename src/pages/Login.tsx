import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Wallet, TrendingUp, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login Error:', error);
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
              <div className="w-12 h-12 bg-primary-container rounded-xl flex items-center justify-center text-white font-serif text-2xl">R</div>
              <h1 className="font-serif font-semibold text-4xl tracking-tight text-on-surface">Reveno <span className="text-secondary font-normal italic ml-1">AI</span></h1>
            </div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-serif text-5xl font-medium text-on-surface leading-tight"
            >
              Institutional-grade treasury management for the modern enterprise.
            </motion.h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-outline-variant">
              <div className="p-3 bg-surface rounded-xl text-primary-container w-fit mb-4">
                <TrendingUp size={24} />
              </div>
              <h3 className="serif text-xl font-medium mb-1">Total Revenue</h3>
              <p className="text-on-surface-variant text-sm">€142,500 <span className="text-primary-container font-semibold">+12.4%</span></p>
            </div>
            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-outline-variant">
              <div className="p-3 bg-surface rounded-xl text-primary-container w-fit mb-4">
                <ShieldCheck size={24} />
              </div>
              <h3 className="serif text-xl font-medium mb-1">Secure Node</h3>
              <p className="text-on-surface-variant text-sm text-[10px] uppercase font-bold tracking-widest">Active Connectivity</p>
            </div>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="flex flex-col items-center lg:items-end">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white p-10 space-y-8 rounded-[40px] shadow-lg border border-outline-variant"
          >
            <div className="space-y-2 text-center lg:text-left">
              <h2 className="font-serif text-3xl font-medium text-on-surface">Welcome back</h2>
              <p className="text-on-surface-variant">Enter your credentials to access your treasury.</p>
            </div>

            <div className="space-y-4">
              <button 
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-4 bg-[#F5F5F0] text-on-background font-bold py-4 rounded-2xl hover:bg-surface transition-all active:scale-[0.98] border border-outline-variant"
              >
                <img 
                  src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                  alt="Google" 
                  className="w-6 h-6"
                />
                Continue with Google
              </button>
              
              <div className="relative flex items-center py-4">
                <div className="flex-grow border-t border-outline-variant"></div>
                <span className="flex-shrink mx-4 text-xs font-bold text-on-surface-variant/50 uppercase tracking-widest">or secure terminal</span>
                <div className="flex-grow border-t border-outline-variant"></div>
              </div>

              <button className="w-full bg-primary-container text-white font-bold py-4 rounded-2xl hover:brightness-110 transition-all shadow-lg shadow-primary-container/20 flex items-center justify-center gap-3">
                <ShieldCheck size={20} />
                Hardware Security Key
              </button>
            </div>

            <div className="text-center pt-4">
              <p className="text-sm text-on-surface-variant/70 italic serif">
                New to Reveno? <a href="#" className="text-primary-container font-bold hover:underline not-italic">Request access</a>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
