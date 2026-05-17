import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { backupData } from '../lib/backup';
import { decryptNumeric } from '../lib/encryption';

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
  updateCompany: (id: string, name: string) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;
  updateGoal: (monthlyGoal: number) => Promise<void>;
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
      setRevenues(snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          revenue: data.isEncrypted ? decryptNumeric(data.revenue) : data.revenue
        };
      }) as Revenue[]);
    });

    // Fetch Goals
    const qGoal = query(
      collection(db, 'goals'),
      where('userId', '==', auth.currentUser.uid),
      where('companyId', '==', selectedCompany.id)
    );
    const unsubGoal = onSnapshot(qGoal, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setGoal({
          id: snapshot.docs[0].id,
          ...data,
          monthlyGoal: data.isEncrypted ? decryptNumeric(data.monthlyGoal) : data.monthlyGoal,
          yearlyGoal: data.isEncrypted ? decryptNumeric(data.yearlyGoal) : data.yearlyGoal
        } as Goal);
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
    const { validateStringInput } = await import('../lib/validation');
    const validation = validateStringInput(name, 2, 50);
    if (!validation.isValid) {
      alert(validation.error);
      return;
    }

    if (!auth.currentUser) return;
    const companyData = {
      name,
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, 'companies'), companyData);
    
    // Automatic Backup System
    await backupData('COMPANY_CAPTURE', companyData);
  };

  const updateCompany = async (id: string, name: string) => {
    const { validateStringInput } = await import('../lib/validation');
    const validation = validateStringInput(name, 2, 50);
    if (!validation.isValid) {
      alert(validation.error);
      return;
    }

    if (!auth.currentUser) return;
    const { doc, updateDoc } = await import('firebase/firestore');
    const companyRef = doc(db, 'companies', id);
    await updateDoc(companyRef, { name });
    
    // Automatic Backup System
    await backupData('COMPANY_UPDATE', { id, name });
  };

  const deleteCompany = async (id: string) => {
    if (!auth.currentUser) return;
    const { doc, deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'companies', id));

    if (selectedCompany?.id === id) {
      setSelectedCompany(null);
      localStorage.removeItem('selectedCompanyId');
    }
    
    // Automatic Backup System
    await backupData('COMPANY_DELETE', { id });
  };

  const updateGoal = async (monthlyGoal: number) => {
    const { validateNumericInput } = await import('../lib/validation');
    const validation = validateNumericInput(monthlyGoal);
    if (!validation.isValid) {
      alert(validation.error);
      return;
    }

    if (!auth.currentUser || !selectedCompany) return;
    const { collection, query, where, getDocs, updateDoc, doc, setDoc } = await import('firebase/firestore');
    const { encryptNumeric } = await import('../lib/encryption');

    const q = query(
      collection(db, 'goals'),
      where('userId', '==', auth.currentUser.uid),
      where('companyId', '==', selectedCompany.id)
    );

    const snapshot = await getDocs(q);
    const yearlyGoal = monthlyGoal * 12;

    const goalData = {
      userId: auth.currentUser.uid,
      companyId: selectedCompany.id,
      monthlyGoal: encryptNumeric(monthlyGoal),
      yearlyGoal: encryptNumeric(yearlyGoal),
      isEncrypted: true,
      updatedAt: serverTimestamp()
    };

    if (snapshot.empty) {
      await addDoc(collection(db, 'goals'), goalData);
      await backupData('GOAL_CAPTURE', { ...goalData, monthlyGoal, yearlyGoal });
    } else {
      const goalRef = doc(db, 'goals', snapshot.docs[0].id);
      await updateDoc(goalRef, goalData);
      await backupData('GOAL_UPDATE', { ...goalData, id: snapshot.docs[0].id, monthlyGoal, yearlyGoal });
    }
  };

  return (
    <CompanyContext.Provider value={{ 
      companies, 
      selectedCompany, 
      setSelectedCompany, 
      revenues, 
      goal, 
      loading, 
      createCompany,
      updateCompany,
      deleteCompany,
      updateGoal
    }}>
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
