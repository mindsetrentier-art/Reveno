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

export interface Transaction {
  id: string;
  name: string;
  type: 'income' | 'expense';
  amount: number;
  status: 'pending' | 'validated';
  date: any;
  companyId: string;
  userId: string;
  createdAt: any;
}

export interface Budget {
  id: string;
  month: string;
  year: number;
  targetRevenue: number;
  expenseLimit: number;
  companyId: string;
  userId: string;
  createdAt: any;
}

interface CompanyContextType {
  companies: Company[];
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company | null) => void;
  revenues: Revenue[];
  detailedEntries: any[];
  transactions: Transaction[];
  budgets: Budget[];
  goal: Goal | null;
  loading: boolean;
  createCompany: (name: string) => Promise<boolean>;
  updateCompany: (id: string, name: string) => Promise<boolean>;
  deleteCompany: (id: string) => Promise<void>;
  updateGoal: (monthlyGoal: number) => Promise<void>;
  updateBudget: (month: string, year: number, targetRevenue: number, expenseLimit: number) => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [detailedEntries, setDetailedEntries] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
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

          setSelectedCompany(prev => {
            const savedId = localStorage.getItem('selectedCompanyId');
            
            // If already have a selected company, try to find its updated version
            const currentId = prev?.id || savedId;
            const updated = fetchedCompanies.find(c => c.id === currentId);
            
            if (updated) {
              // Only update if something actually changed (name, etc) or if it's the first selection
              if (JSON.stringify(updated) !== JSON.stringify(prev)) {
                 return updated;
              }
              return prev;
            } else if (fetchedCompanies.length > 0) {
              return fetchedCompanies[0];
            }
            return null;
          });
          
          setLoading(false);
        }, (error) => {
          console.error("Company snapshot error:", error);
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
      setDetailedEntries([]);
      setTransactions([]);
      setBudgets([]);
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
    }, (error) => {
      console.error("Revenue fetch error:", error);
    });

    // Fetch Transactions
    const qTrans = query(
      collection(db, 'transactions'),
      where('userId', '==', auth.currentUser.uid),
      where('companyId', '==', selectedCompany.id),
      orderBy('date', 'desc')
    );
    const unsubTrans = onSnapshot(qTrans, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          amount: data.isEncrypted ? decryptNumeric(data.amount) : (data.amount || 0)
        };
      }) as Transaction[]);
    }, (error) => {
      console.error("Transaction fetch error:", error);
    });

    // Fetch Budgets
    const qBudgets = query(
      collection(db, 'budgets'),
      where('userId', '==', auth.currentUser.uid),
      where('companyId', '==', selectedCompany.id),
      orderBy('year', 'desc')
    );
    const unsubBudgets = onSnapshot(qBudgets, (snapshot) => {
      setBudgets(snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          targetRevenue: data.isEncrypted ? decryptNumeric(data.targetRevenue) : data.targetRevenue,
          expenseLimit: data.isEncrypted ? decryptNumeric(data.expenseLimit) : data.expenseLimit
        };
      }) as Budget[]);
    }, (error) => {
      console.error("Budgets fetch error:", error);
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
    }, (error) => {
      console.error("Goal fetch error:", error);
    });

    // Fetch Detailed Entries
    const qDetailed = query(
      collection(db, 'detailed_entries'),
      where('userId', '==', auth.currentUser.uid),
      where('companyId', '==', selectedCompany.id),
      orderBy('date', 'desc')
    );
    const unsubDetailed = onSnapshot(qDetailed, (snapshot) => {
      setDetailedEntries(snapshot.docs.map(doc => {
        const data = doc.data() as any;
        if (data.isEncrypted) {
          const decryptedBreakdown: Record<string, number> = {};
          if (data.breakdown) {
            Object.entries(data.breakdown).forEach(([k, v]) => {
              decryptedBreakdown[k] = decryptNumeric(v as string);
            });
          }
          return {
            id: doc.id,
            ...data,
            breakdown: decryptedBreakdown,
            total: decryptNumeric(data.total),
            date: data.date?.toDate() || new Date()
          };
        }
        return { 
          id: doc.id, 
          ...data,
          date: data.date?.toDate() || new Date()
        };
      }));
    }, (error) => {
      console.error("Detailed entries fetch error:", error);
    });

    return () => {
      unsubRev();
      unsubGoal();
      unsubDetailed();
      unsubTrans();
      unsubBudgets();
    };
  }, [selectedCompany]);

  useEffect(() => {
    if (selectedCompany) {
      localStorage.setItem('selectedCompanyId', selectedCompany.id);
    }
  }, [selectedCompany]);

  const createCompany = async (name: string): Promise<boolean> => {
    try {
      const { validateStringInput } = await import('../lib/validation');
      const validation = validateStringInput(name, 1, 50);
      if (!validation.isValid) {
        alert(validation.error);
        return false;
      }

      if (!auth.currentUser) return false;
      const companyData = {
        name: name.trim(),
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'companies'), companyData);
      
      // Automatic Backup System
      await backupData('COMPANY_CAPTURE', { ...companyData, id: docRef.id });

      setSelectedCompany({ id: docRef.id, ...companyData } as Company);
      localStorage.setItem('selectedCompanyId', docRef.id);
      return true;
    } catch (error) {
      console.error("Create company error:", error);
      alert("Erreur lors de la création de l'entité. Vérifiez votre connexion.");
      return false;
    }
  };

  const updateCompany = async (id: string, name: string): Promise<boolean> => {
    try {
      const { validateStringInput } = await import('../lib/validation');
      const validation = validateStringInput(name, 1, 50);
      if (!validation.isValid) {
        alert(validation.error);
        return false;
      }

      if (!auth.currentUser) return false;
      const { doc, updateDoc } = await import('firebase/firestore');
      const companyRef = doc(db, 'companies', id);
      await updateDoc(companyRef, { name: name.trim() });
      
      // Automatic Backup System
      await backupData('COMPANY_UPDATE', { id, name: name.trim() });
      return true;
    } catch (error) {
      console.error("Update company error:", error);
      alert("Erreur lors de la mise à jour de l'entité.");
      return false;
    }
  };

  const deleteCompany = async (id: string) => {
    try {
      if (!auth.currentUser) return;
      const { doc, deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'companies', id));

      if (selectedCompany?.id === id) {
        setSelectedCompany(null);
        localStorage.removeItem('selectedCompanyId');
      }
      
      // Automatic Backup System
      await backupData('COMPANY_DELETE', { id });
    } catch (error) {
      console.error("Delete company error:", error);
      alert("Erreur lors de la suppression de l'entité.");
    }
  };

  const updateGoal = async (monthlyGoal: number) => {
    try {
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
    } catch (error) {
      console.error("Update goal error:", error);
      alert("Erreur lors de la mise à jour de l'objectif.");
    }
  };

  const updateBudget = async (month: string, year: number, targetRevenue: number, expenseLimit: number) => {
    try {
      const { validateNumericInput } = await import('../lib/validation');
      
      const revVal = validateNumericInput(targetRevenue);
      if (!revVal.isValid) {
        alert(`Chiffre d'affaires cible: ${revVal.error}`);
        return;
      }

      const expVal = validateNumericInput(expenseLimit);
      if (!expVal.isValid) {
        alert(`Limite de dépenses: ${expVal.error}`);
        return;
      }

      if (!auth.currentUser || !selectedCompany) return;
      const { collection, query, where, getDocs, updateDoc, doc } = await import('firebase/firestore');
      const { encryptNumeric } = await import('../lib/encryption');

      const q = query(
        collection(db, 'budgets'),
        where('userId', '==', auth.currentUser.uid),
        where('companyId', '==', selectedCompany.id),
        where('month', '==', month),
        where('year', '==', year)
      );

      const snapshot = await getDocs(q);
      const budgetData: any = {
        userId: auth.currentUser.uid,
        companyId: selectedCompany.id,
        month,
        year,
        targetRevenue: encryptNumeric(targetRevenue),
        expenseLimit: encryptNumeric(expenseLimit),
        isEncrypted: true,
        updatedAt: serverTimestamp()
      };

      if (snapshot.empty) {
        budgetData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'budgets'), budgetData);
        await backupData('BUDGET_CREATE', budgetData);
      } else {
        const budgetRef = doc(db, 'budgets', snapshot.docs[0].id);
        await updateDoc(budgetRef, budgetData);
        await backupData('BUDGET_UPDATE', { ...budgetData, id: snapshot.docs[0].id });
      }
    } catch (error) {
      console.error("Update budget error:", error);
      alert("Erreur lors de la mise à jour du budget.");
    }
  };

  return (
    <CompanyContext.Provider value={{ 
      companies, 
      selectedCompany, 
      setSelectedCompany, 
      revenues, 
      detailedEntries,
      transactions,
      budgets,
      goal, 
      loading, 
      createCompany,
      updateCompany,
      deleteCompany,
      updateGoal,
      updateBudget
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
