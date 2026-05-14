// src/App.tsx
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { auth, wsClient } from './lib/api';
import LandingPage   from './pages/LandingPage';
import Dashboard     from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import LoginPage     from './pages/LoginPage';
import Docs          from './pages/Docs';
import Monitoring    from './pages/Monitoring';

function App() {
  const [user, setUser]       = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Cek apakah sudah login (token di localStorage)
    if (auth.isLoggedIn()) {
      // Verifikasi token ke server
      auth.me()
        .then(({ user: u }) => {
          setUser(u);
          // Connect WebSocket setelah login
          wsClient.connect();
        })
        .catch(() => {
          // Token expired/invalid
          auth.logout();
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (userData: any) => {
    setUser(userData);
    wsClient.connect();
  };

  const handleLogout = async () => {
    await auth.logout();
    wsClient.disconnect();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={40} className="animate-spin text-indigo-400" />
          <span className="text-sm text-gray-500">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<LandingPage user={user} />} />
        <Route path="/docs"      element={<Docs user={user} />} />
        <Route path="/login"     element={user ? <Navigate to="/dashboard" /> : <LoginPage onLogin={handleLogin} />} />
        <Route path="/signup"    element={<Navigate to="/login" />} />
        <Route path="/dashboard" element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
        <Route path="/monitoring" element={user ? <Monitoring user={user} /> : <Navigate to="/login" />} />
        <Route path="/project/:id" element={user ? <ProjectDetail user={user} /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
