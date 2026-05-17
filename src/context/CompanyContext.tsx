import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export interface Company {
  id: string;
  name: string;
  userId: string;
  createdAt: any;
}

export interface Revenue {
  id: string;
  month: string;
  revenue: number;
  companyId: string;
  userId: string;
  createdAt: any;
}

export interface Goal {
  id: string;
  monthlyGoal: number;
  yearlyGoal: number;
  companyId: string;
  userId: string;
}

interface CompanyContextType {
  companies: Company[];
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company | null) => void;
  revenues: Revenue[];
  goal: Goal | null;
  loading: boolean;
  createCompany: (name: string) => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [goal, setGoal] = useState<Goal | null>(null);
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
    if (!auth.currentUser || !selectedCompany) {
      setRevenues([]);
      setGoal(null);
      return;
    }

    // Fetch Revenues
    const qRev = query(
      collection(db, 'revenues'),
      where('userId', '==', auth.currentUser.uid),
      where('companyId', '==', selectedCompany.id),
      orderBy('createdAt', 'desc')
    );
    const unsubRev = onSnapshot(qRev, (snapshot) => {
      setRevenues(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Revenue[]);
    });

    // Fetch Goals
    const qGoal = query(
      collection(db, 'goals'),
      where('userId', '==', auth.currentUser.uid),
      where('companyId', '==', selectedCompany.id)
    );
    const unsubGoal = onSnapshot(qGoal, (snapshot) => {
      if (!snapshot.empty) {
        setGoal({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Goal);
      } else {
        setGoal(null);
      }
    });

    return () => {
      unsubRev();
      unsubGoal();
    };
  }, [selectedCompany]);

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
    <CompanyContext.Provider value={{ companies, selectedCompany, setSelectedCompany, revenues, goal, loading, createCompany }}>
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
