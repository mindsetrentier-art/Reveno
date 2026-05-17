import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db, auth } from '../lib/firebase';

export interface Revenue {
  id: string;
  month: string;
  revenue: number;
  userId: string;
  createdAt: any;
}

export interface Goal {
  id: string;
  monthlyGoal: number;
  yearlyGoal: number;
  userId: string;
}

export function useRevenueData(companyId?: string) {
  const [data, setData] = useState<Revenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser || !companyId) {
      setData([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'revenues'),
      where('userId', '==', auth.currentUser.uid),
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const revenues = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Revenue[];
      setData(revenues);
      setLoading(false);
    }, (error) => {
        console.error("Revenue Query Error:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [companyId]);

  return { data, loading };
}

export function useGoalData(companyId?: string) {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser || !companyId) {
      setGoal(null);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'goals'),
      where('userId', '==', auth.currentUser.uid),
      where('companyId', '==', companyId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const goalData = {
          id: snapshot.docs[0].id,
          ...snapshot.docs[0].data()
        } as Goal;
        setGoal(goalData);
      } else {
        setGoal(null);
      }
      setLoading(false);
    }, (error) => {
        console.error("Goal Query Error:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [companyId]);

  return { goal, loading };
}
