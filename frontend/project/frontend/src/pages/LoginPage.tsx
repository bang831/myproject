// src/pages/LoginPage.tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Mail, Lock, ArrowRight, Eye, EyeOff, AlertTriangle, Loader2, Terminal } from 'lucide-react';
import { auth } from '../lib/api';

interface LoginPageProps {
  onLogin: (user: any) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSetup, setIsSetup]       = useState(false); // First-time setup mode
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let data;
      if (isSetup) {
        // First-time register
        data = await auth.register(email, password);
      } else {
        data = await auth.login(email, password);
      }
      onLogin(data.user);
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err.message || 'Terjadi kesalahan.';
      // Jika setup mode dan registrasi ditutup, switch ke login
      if (msg.includes('private') || msg.includes('ditutup')) {
        setIsSetup(false);
        setError('Registrasi ditutup. Silakan login dengan akun yang ada.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-indigo-500/8 blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-purple-500/8 blur-[150px]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(99,102,241,0.5) 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Terminal size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold text-white">DeployFlow</span>
          </Link>
          <h1 className="text-2xl font-bold text-white mb-2">
            {isSetup ? 'Setup Akun Admin' : 'Masuk ke Panel'}
          </h1>
          <p className="text-sm text-gray-500">
            {isSetup
              ? 'Buat akun admin pertama untuk mulai deploy'
              : 'Self-hosted Railway di Android 😄'}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.08] p-8 backdrop-blur-sm">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-6"
            >
              <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/25 transition-all text-sm"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-12 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/25 transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-sm font-semibold text-white hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/25"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {isSetup ? 'Buat Akun & Masuk' : 'Masuk'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Toggle setup mode */}
          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsSetup(!isSetup); setError(''); }}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              {isSetup
                ? '← Sudah punya akun? Login'
                : 'Belum ada akun? Setup pertama kali →'}
            </button>
          </div>
        </div>

        {/* Info */}
        <p className="text-center text-xs text-gray-700 mt-6">
          Berjalan di Android · Termux · Ubuntu proot · Nginx · PM2
        </p>
      </motion.div>
    </div>
  );
}
