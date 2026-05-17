import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export interface Company {
  id: string;
  name: string;
  userId: string;
  createdAt: any;
}

interface CompanyContextType {
  companies: Company[];
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company | null) => void;
  loading: boolean;
  createCompany: (name: string) => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const q = query(
          collection(db, 'companies'),
          where('userId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const fetchedCompanies = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Company[];
          
          setCompanies(fetchedCompanies);

          // Restore from localStorage or pick first
          const savedId = localStorage.getItem('selectedCompanyId');
          const saved = fetchedCompanies.find(c => c.id === savedId);
          
          if (saved) {
            setSelectedCompany(saved);
          } else if (fetchedCompanies.length > 0) {
            setSelectedCompany(fetchedCompanies[0]);
          } else {
            setSelectedCompany(null);
          }
          
          setLoading(false);
        });

        return () => unsubscribe();
      } else {
        setCompanies([]);
        setSelectedCompany(null);
        setLoading(false);
      }
    });

    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      localStorage.setItem('selectedCompanyId', selectedCompany.id);
    }
  }, [selectedCompany]);

  const createCompany = async (name: string) => {
    if (!auth.currentUser) return;
    await addDoc(collection(db, 'companies'), {
      name,
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
    });
  };

  return (
    <CompanyContext.Provider value={{ companies, selectedCompany, setSelectedCompany, loading, createCompany }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
