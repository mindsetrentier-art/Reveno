import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { auth } from './lib/firebase';
import { CompanyProvider } from './context/CompanyContext';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Revenue from './pages/Revenue';
import AIIntelligence from './pages/AIIntelligence';
import DetailedEntry from './pages/DetailedEntry';
import Backups from './pages/Backups';
import Reports from './pages/Reports';
import Layout from './components/Layout';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F9F6] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-container border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Router>
      <CompanyProvider>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
          
          <Route element={user ? <Layout /> : <Navigate to="/login" />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/revenue" element={<Revenue />} />
            <Route path="/saisie" element={<DetailedEntry />} />
            <Route path="/ai" element={<AIIntelligence />} />
            <Route path="/backups" element={<Backups />} />
            <Route path="/reports" element={<Reports />} />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </CompanyProvider>
    </Router>
  );
}
