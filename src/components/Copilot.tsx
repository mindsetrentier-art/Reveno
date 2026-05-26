import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, Send, User, Bot, Loader2, MessageSquare, ChevronLeft } from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import { cn } from '../lib/utils';

interface Message {
  role: 'user' | 'model';
  content: string;
}

export default function Copilot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const minimizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { selectedCompany, revenues, goal } = useCompany();

  const startMinimizeTimer = useCallback(() => {
    if (minimizeTimeoutRef.current) clearTimeout(minimizeTimeoutRef.current);
    minimizeTimeoutRef.current = setTimeout(() => {
      setIsMinimized(true);
    }, 20000); // 20 seconds
  }, []);

  useEffect(() => {
    if (!isOpen) {
      startMinimizeTimer();
    } else {
      setIsMinimized(false);
      if (minimizeTimeoutRef.current) clearTimeout(minimizeTimeoutRef.current);
    }
    return () => {
      if (minimizeTimeoutRef.current) clearTimeout(minimizeTimeoutRef.current);
    };
  }, [isOpen, startMinimizeTimer]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          history: messages,
          context: {
            companyName: selectedCompany?.name,
            revenues,
            goals: goal
          }
        })
      });

      if (!response.ok) throw new Error('Failed to fetch response');
      const data = await response.json();
      
      const botMessage: Message = { role: 'model', content: data.content };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Copilot Chat Error:', error);
      setMessages(prev => [...prev, { role: 'model', content: "Désolé, j'ai rencontré une erreur technique en essayant d'analyser vos données. Veuillez réessayer dans quelques instants." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = () => {
    if (isMinimized) {
      setIsMinimized(false);
      startMinimizeTimer();
    } else {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className="fixed md:bottom-8 bottom-24 right-0 pr-4 md:pr-8 z-[100] flex items-end justify-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 mr-0 w-96 max-w-[calc(100vw-2rem)] h-[500px] sm:h-[600px] max-h-[calc(100vh-12rem)] bg-white rounded-[32px] shadow-2xl border border-outline-variant flex flex-col overflow-hidden absolute bottom-[65px] md:bottom-[70px] right-4 md:right-8"
          >
            {/* Header */}
            <div className="p-6 bg-primary-container text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Sparkles size={20} className="text-secondary" />
                </div>
                <div>
                  <h3 className="font-display font-bold leading-none">Copilote Financier</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[10px] uppercase font-bold tracking-widest opacity-60">Intelligence Reveno Active</p>
                    <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></span>
                    <p className="text-[8px] uppercase font-bold tracking-tighter opacity-40">Backup Automatique</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-grow overflow-y-auto p-6 space-y-4 scroll-smooth">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50 px-8">
                  <Bot size={48} className="text-primary-container" />
                  <p className="text-sm font-sans italic">
                    Bonjour ! Je suis votre copilote Reveno. Posez-moi des questions sur votre trésorerie ou demandez-moi une analyse de vos revenus.
                  </p>
                </div>
              )}
              {messages.map((m, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "flex gap-3 max-w-[85%]",
                    m.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    m.role === 'user' ? "bg-secondary text-white" : "bg-primary-container/10 text-primary-container"
                  )}>
                    {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                  </div>
                  <div className={cn(
                    "p-4 rounded-2xl text-sm leading-relaxed",
                    m.role === 'user' 
                      ? "bg-secondary text-white rounded-tr-none" 
                      : "bg-surface border border-outline-variant rounded-tl-none text-on-surface"
                  )}>
                    {m.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 mr-auto">
                  <div className="w-8 h-8 rounded-full bg-primary-container/10 text-primary-container flex items-center justify-center shrink-0">
                    <Bot size={14} />
                  </div>
                  <div className="bg-surface border border-outline-variant p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-primary-container" />
                    <span className="text-xs font-bold uppercase tracking-widest opacity-50">Analyse du grand livre...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <form 
              onSubmit={handleSend}
              className="p-6 pt-2 border-t border-outline-variant shrink-0"
            >
              <div className="relative">
                <input 
                  type="text"
                  placeholder="Posez une question sur vos finances..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="w-full bg-background border border-outline-variant rounded-2xl px-5 py-4 pr-12 focus:outline-none focus:border-secondary transition-all font-sans text-sm"
                />
                <button 
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-primary-container text-white flex items-center justify-center rounded-xl hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={handleToggle}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        layout
        className={cn(
          "bg-primary-container text-white shadow-2xl flex items-center justify-center relative group transition-all duration-500",
          isMinimized ? "w-2 h-10 rounded-l-md rounded-r-none absolute right-0 translate-x-1 hover:translate-x-0 cursor-pointer" : "w-16 h-16 rounded-full"
        )}
      >
        <AnimatePresence mode="popLayout">
          {isMinimized ? (
            <motion.div key="minimized" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex flex-col justify-center items-center opacity-50">
               <div className="w-1 h-3 bg-white/50 rounded-full" />
            </motion.div>
          ) : isOpen ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X size={28} />
            </motion.div>
          ) : (
            <motion.div key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <MessageSquare size={28} />
            </motion.div>
          )}
        </AnimatePresence>
        
        {!isMinimized && (
          <motion.div 
            initial={{ opacity: 0, scale: 0 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0 }} 
            className="absolute -top-1 -right-1 w-6 h-6 bg-secondary text-white text-[10px] font-bold flex items-center justify-center rounded-full border-4 border-white shadow-lg"
          >
             <Sparkles size={10} />
          </motion.div>
        )}
        
        {/* Tooltip */}
        {!isOpen && !isMinimized && (
          <div className="absolute right-20 bg-primary-container text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl border border-white/10">
            Copilote IA disponible
          </div>
        )}
      </motion.button>
    </div>
  );
}
