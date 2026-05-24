import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, LogOut, ShieldAlert } from 'lucide-react';
import { auth } from '../lib/firebase';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    (this as any).state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error inside React Tree:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleDisconnect = async () => {
    try {
      await auth.signOut();
      localStorage.clear();
      window.location.href = '/login';
    } catch (e) {
      console.error('Sign out failed from error boundary', e);
      window.location.href = '/login';
    }
  };

  public render() {
    const currentState = (this as any).state as State;
    if (currentState && currentState.hasError) {
      return (
        <div className="min-h-screen bg-[#F9F9F6] text-[#2C2C20] flex flex-col items-center justify-center p-6 select-none font-sans">
          <div className="absolute inset-0 pointer-events-none dot-grid opacity-30"></div>
          
          <div className="max-w-md w-full bg-white rounded-[32px] border border-outline-variant shadow-2xl p-8 space-y-8 relative z-10 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <ShieldAlert size={36} />
            </div>

            <div className="space-y-3">
              <h2 className="font-display text-2xl font-black tracking-tight">Erreur d'initialisation détectée</h2>
              <p className="text-on-surface-variant text-sm leading-relaxed">
                Une anomalie technique a perturbé le chargement de votre tableau de bord Reveno. Cela peut être dû à un délai de synchronisation ou une session expirée.
              </p>
            </div>

            {currentState.error && (
              <div className="p-4 bg-surface rounded-2xl text-left border border-outline-variant/60">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70 mb-1">Rapport d'anomalie :</p>
                <code className="text-[11px] font-mono whitespace-pre-wrap break-all text-red-600 leading-normal font-medium">
                  {currentState.error.message || 'Unknown render error'}
                </code>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 bg-[#5A5A40] text-white py-3.5 px-4 rounded-xl font-bold hover:brightness-110 active:scale-[0.98] transition-all text-xs tracking-wider uppercase shadow-lg shadow-[#5A5A40]/15"
              >
                <RefreshCw size={14} />
                Actualiser
              </button>
              <button
                onClick={this.handleDisconnect}
                className="flex items-center justify-center gap-2 bg-white text-on-surface border border-outline-variant py-3.5 px-4 rounded-xl font-bold hover:bg-surface active:scale-[0.98] transition-all text-xs tracking-wider uppercase shadow-sm"
              >
                <LogOut size={14} />
                Se reconnecter
              </button>
            </div>
            
            <p className="text-[10px] text-on-surface-variant/50">
              Note : S'il s'agit d'une première connexion, actualiser résout l'initialisation de votre première entité.
            </p>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
