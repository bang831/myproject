#!/bin/bash
set -e

FRONTEND="/root/panel/frontend/src"

echo "🎨 Updating DeployFlow design..."

# ── LandingPage.tsx ──────────────────────────────────────────────────────
cat > "$FRONTEND/pages/LandingPage.tsx" << 'EOF'
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Terminal, GitBranch, Globe, Activity, Upload, ArrowRight, Zap, Shield, Server } from 'lucide-react';

const features = [
  { icon: GitBranch, title: 'Deploy dari GitHub',     desc: 'Connect repo, pilih branch, dan deploy otomatis dalam hitungan detik.',                           gradient: 'from-indigo-500/15 to-purple-500/15',  border: 'border-indigo-500/20', iconBg: 'bg-indigo-500/10',  iconColor: 'text-indigo-400'  },
  { icon: Globe,     title: 'Custom Domain',           desc: 'Integrasi langsung dengan Cloudflare. Domain siap pakai tanpa konfigurasi manual.',               gradient: 'from-cyan-500/15 to-blue-500/15',      border: 'border-cyan-500/20',   iconBg: 'bg-cyan-500/10',    iconColor: 'text-cyan-400'    },
  { icon: Activity,  title: 'Real-time Monitoring',    desc: 'Pantau CPU, memory, dan uptime semua project dari satu dashboard.',                               gradient: 'from-emerald-500/15 to-teal-500/15',  border: 'border-emerald-500/20',iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-400' },
  { icon: Upload,    title: 'Upload File / ZIP',       desc: 'Drag & drop file, folder, atau ZIP langsung dari browser. Tanpa git.',                            gradient: 'from-orange-500/15 to-amber-500/15',  border: 'border-orange-500/20', iconBg: 'bg-orange-500/10',  iconColor: 'text-orange-400'  },
  { icon: Zap,       title: 'PM2 Powered',             desc: 'Process management dengan PM2. Auto-restart, zero downtime deploy.',                             gradient: 'from-yellow-500/15 to-orange-500/15', border: 'border-yellow-500/20', iconBg: 'bg-yellow-500/10',  iconColor: 'text-yellow-400'  },
  { icon: Shield,    title: 'Self-Hosted',             desc: 'Data lo, server lo. Jalan di Android via Termux + Ubuntu proot.',                                gradient: 'from-pink-500/15 to-rose-500/15',     border: 'border-pink-500/20',   iconBg: 'bg-pink-500/10',    iconColor: 'text-pink-400'    },
];

const stack = ['Termux', 'Ubuntu proot', 'Nginx', 'PM2', 'Cloudflare', 'Node.js', 'React'];
const stats = [{ val: '< 1s', label: 'Deploy time' }, { val: '∞', label: 'Projects' }, { val: '24/7', label: 'Uptime monitoring' }];

export default function LandingPage({ user }: { user: any }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#080B14] relative overflow-hidden font-sans">
      <div className="absolute inset-0 pointer-events-none select-none">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-indigo-600/10 blur-[180px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-purple-700/8 blur-[140px]" />
        <div className="absolute bottom-1/3 left-0 w-[300px] h-[300px] rounded-full bg-cyan-700/6 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.8) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
      </div>

      <nav className="relative z-10 flex items-center justify-between px-6 md:px-16 py-5 border-b border-white/[0.04] backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30"><Terminal size={15} className="text-white" /></div>
          <span className="text-lg font-bold text-white tracking-tight">DeployFlow</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/docs')} className="text-sm text-gray-500 hover:text-gray-300 transition-colors px-4 py-2 rounded-lg hover:bg-white/[0.04]">Docs</button>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => navigate(user ? '/dashboard' : '/login')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:opacity-90 transition-opacity">
            {user ? 'Dashboard' : 'Login'} <ArrowRight size={14} />
          </motion.button>
        </div>
      </nav>

      <section className="relative z-10 text-center px-6 pt-24 pb-16">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-xs text-indigo-400 font-medium mb-8">
            <Server size={11} /><span>Self-hosted · Running on Android</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-[1.05] tracking-tight">
            Deploy App{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">dari HP</span>
            <br />lo sendiri.
          </h1>
          <p className="text-lg md:text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            Mini Railway &amp; Vercel yang jalan di Android. Deploy dari GitHub, upload file, manage domain Cloudflare — semua dari satu panel.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <motion.button whileHover={{ scale: 1.04, y: -1 }} whileTap={{ scale: 0.97 }} onClick={() => navigate(user ? '/dashboard' : '/login')}
              className="flex items-center gap-2.5 px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-base font-bold text-white shadow-2xl shadow-indigo-500/30">
              {user ? 'Buka Dashboard' : 'Mulai Sekarang'} <ArrowRight size={17} />
            </motion.button>
            <motion.button whileHover={{ scale: 1.04, y: -1 }} whileTap={{ scale: 0.97 }} onClick={() => navigate('/docs')}
              className="flex items-center gap-2.5 px-8 py-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-base font-medium text-gray-300 hover:bg-white/[0.08] transition-all">
              Baca Docs
            </motion.button>
          </div>
        </motion.div>
      </section>

      <section className="relative z-10 px-6 pb-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}
          className="max-w-2xl mx-auto grid grid-cols-3 divide-x divide-white/[0.05] rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02]">
          {stats.map((s, i) => (
            <div key={i} className="px-6 py-8 text-center">
              <div className="text-3xl md:text-4xl font-black text-white mb-1.5">{s.val}</div>
              <div className="text-xs text-gray-600 uppercase tracking-widest">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      <section className="relative z-10 px-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">Semua yang lo butuhkan</h2>
            <p className="text-gray-500 text-base">Dari deploy sampai monitoring, semua ada dalam satu panel.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.07, duration: 0.45 }}
                className={`group p-6 rounded-2xl bg-gradient-to-br ${f.gradient} border ${f.border} hover:scale-[1.025] hover:shadow-xl transition-all duration-200`}>
                <div className={`w-11 h-11 rounded-xl ${f.iconBg} border ${f.border} flex items-center justify-center mb-5`}>
                  <f.icon size={19} className={f.iconColor} />
                </div>
                <h3 className="font-semibold text-white text-base mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 pb-20 text-center px-6">
        <p className="text-xs text-gray-700 uppercase tracking-[0.2em] mb-5 font-medium">Dibangun dengan</p>
        <div className="flex items-center justify-center flex-wrap gap-2.5">
          {stack.map((s, i) => (
            <span key={i} className="px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.07] text-xs text-gray-500 font-mono hover:border-white/[0.12] hover:text-gray-400 transition-colors">{s}</span>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/[0.04] px-6 py-6 text-center">
        <p className="text-xs text-gray-700">Made with ❤️ on Android · DeployFlow</p>
      </footer>
    </div>
  );
}
EOF

echo "✅ LandingPage.tsx updated"

# ── LoginPage.tsx ────────────────────────────────────────────────────────
cat > "$FRONTEND/pages/LoginPage.tsx" << 'EOF'
// src/pages/LoginPage.tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, Eye, EyeOff, AlertTriangle, Loader2, Terminal, Sparkles } from 'lucide-react';
import { auth } from '../lib/api';

interface LoginPageProps { onLogin: (user: any) => void; }

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSetup, setIsSetup]           = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const data = isSetup ? await auth.register(email, password) : await auth.login(email, password);
      onLogin(data.user); navigate('/dashboard');
    } catch (err: any) {
      const msg = err.message || 'Terjadi kesalahan.';
      if (msg.includes('private') || msg.includes('ditutup')) { setIsSetup(false); setError('Registrasi ditutup. Silakan login dengan akun yang ada.'); }
      else setError(msg);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#080B14] flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-indigo-600/10 blur-[160px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-purple-600/8 blur-[130px]" />
        <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(99,102,241,0.6) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      </div>

      <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative z-10 w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-6 group">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50 transition-shadow">
              <Terminal size={20} className="text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">DeployFlow</span>
          </Link>
          <h1 className="text-2xl font-bold text-white mb-2">{isSetup ? 'Setup Akun Admin' : 'Masuk ke Panel'}</h1>
          <p className="text-sm text-gray-500">{isSetup ? 'Buat akun admin pertama untuk mulai deploy' : 'Self-hosted Railway di Android 📱'}</p>
        </div>

        <div className="rounded-2xl bg-white/[0.025] border border-white/[0.08] shadow-2xl backdrop-blur-sm overflow-hidden">
          <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500 to-purple-600" />
          <div className="p-8">
            {error && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-6">
                <AlertTriangle size={15} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-400 leading-snug">{error}</p>
              </motion.div>
            )}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com" required
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-gray-700 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition-all text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6}
                    className="w-full pl-10 pr-12 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-gray-700 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition-all text-sm" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <motion.button type="submit" disabled={loading} whileHover={{ scale: loading ? 1 : 1.02 }} whileTap={{ scale: loading ? 1 : 0.98 }}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-sm font-bold text-white hover:opacity-95 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/25 mt-2">
                {loading ? <Loader2 size={17} className="animate-spin" /> : <><Sparkles size={15} />{isSetup ? 'Buat Akun & Masuk' : 'Masuk ke Dashboard'}<ArrowRight size={15} /></>}
              </motion.button>
            </form>
            <div className="mt-6 text-center">
              <button onClick={() => { setIsSetup(!isSetup); setError(''); }} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                {isSetup ? '← Sudah punya akun? Login' : 'Belum ada akun? Setup pertama kali →'}
              </button>
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-gray-700 mt-6">Termux · Ubuntu proot · Nginx · PM2</p>
      </motion.div>
    </div>
  );
}
EOF

echo "✅ LoginPage.tsx updated"

# ── Dashboard.tsx ─────────────────────────────────────────────────────────
cat > "$FRONTEND/pages/Dashboard.tsx" << 'EOF'
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, ExternalLink, Trash2, GitBranch, Clock, CheckCircle2, XCircle,
  Loader2, ChevronRight, FolderOpen, History, Settings as SettingsIcon,
  LogOut, LayoutDashboard, Monitor, Link as LinkIcon, Terminal, Globe,
  RefreshCw, X, Upload, FileText, Archive,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import { projects as projectsApi, cloudflare, wsClient } from '../lib/api';
import Monitoring from './Monitoring';
import Settings from './Settings';

interface Project {
  id: number; app_id: string; name: string; repo_url?: string;
  branch: string; framework: string; project_type?: string;
  domain?: string; port?: number; status: string; created_at: string;
  deployment_count?: number;
}

const sidebarItems = [
  { icon: LayoutDashboard, label: 'Projects',    id: 'projects'    },
  { icon: Monitor,         label: 'Monitoring',  id: 'monitoring'  },
  { icon: History,         label: 'Deployments', id: 'deployments' },
  { icon: SettingsIcon,    label: 'Settings',    id: 'settings'    },
];

function Sidebar({ user, onLogout, activeTab, setActiveTab }: any) {
  const navigate = useNavigate();
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-[#080B14] border-r border-white/[0.05] flex flex-col z-40 hidden lg:flex">
      <div className="p-6 border-b border-white/[0.05]">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Terminal size={16} className="text-white" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">DeployFlow</span>
          <NotificationBell />
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-0.5">
        {sidebarItems.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all relative ${
              activeTab === item.id ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
            }`}>
            {activeTab === item.id && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-400 rounded-r-full" />}
            <item.icon size={17} />{item.label}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-white/[0.05]">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] mb-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">{user?.email?.[0]?.toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.email}</p>
            <p className="text-xs text-gray-600">Admin</p>
          </div>
        </div>
        <button onClick={onLogout} className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm text-gray-600 hover:text-red-400 hover:bg-red-500/5 transition-all">
          <LogOut size={15} />Sign Out
        </button>
      </div>
    </aside>
  );
}

function UploadZone({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const fileRef   = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const addFiles = (fl: FileList | null) => { if (!fl) return; onChange([...files, ...Array.from(fl)]); };
  const fmt = (b: number) => b < 1024*1024 ? `${(b/1024).toFixed(1)}KB` : `${(b/1024/1024).toFixed(1)}MB`;
  const total = files.reduce((a, f) => a + f.size, 0);
  const icon = (name: string) => {
    const e = name.split('.').pop()?.toLowerCase();
    if (e === 'zip') return <Archive size={13} className="text-yellow-400 shrink-0" />;
    if (['html','htm','css','js'].includes(e||'')) return <FileText size={13} className="text-blue-400 shrink-0" />;
    return <FileText size={13} className="text-gray-500 shrink-0" />;
  };
  return (
    <div className="space-y-2">
      <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed transition-all cursor-pointer ${dragging ? 'border-indigo-500/60 bg-indigo-500/10' : files.length > 0 ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-white/10 hover:border-white/20 bg-white/[0.02]'}`}>
        <Upload size={22} className={files.length > 0 ? 'text-indigo-400' : 'text-gray-600'} />
        <div className="text-center">
          <p className="text-sm text-gray-400">Drag &amp; drop file atau folder kesini</p>
          <p className="text-xs text-gray-600 mt-0.5">ZIP · HTML · CSS · JS · Folder project</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-400 hover:bg-white/10 transition-all"><FileText size={12} />Pilih File</button>
          <button type="button" onClick={() => folderRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-400 hover:bg-white/10 transition-all"><FolderOpen size={12} />Pilih Folder</button>
        </div>
        <input ref={fileRef} type="file" multiple className="hidden" accept=".zip,.html,.htm,.css,.js,.ts,.tsx,.jsx,.json,.png,.jpg,.svg,.ico" onChange={e => addFiles(e.target.files)} />
        {/* @ts-ignore */}
        <input ref={folderRef} type="file" multiple webkitdirectory="" directory="" className="hidden" onChange={e => addFiles(e.target.files)} />
      </div>
      {files.length > 0 && (
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
            <span className="text-xs text-gray-500">{files.length} file · {fmt(total)}</span>
            <button type="button" onClick={() => onChange([])} className="text-xs text-gray-600 hover:text-red-400">Clear</button>
          </div>
          <div className="max-h-36 overflow-y-auto divide-y divide-white/5">
            {files.slice(0, 15).map((f, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-1.5">
                {icon(f.name)}
                <span className="flex-1 text-xs text-gray-400 truncate">{f.name}</span>
                <span className="text-xs text-gray-600">{fmt(f.size)}</span>
                <button type="button" onClick={() => onChange(files.filter((_,j)=>j!==i))} className="text-gray-700 hover:text-red-400 ml-1"><X size={11} /></button>
              </div>
            ))}
            {files.length > 15 && <div className="px-4 py-1.5 text-xs text-gray-600">+{files.length-15} lainnya...</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function NewProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: any) => void }) {
  const [tab, setTab]             = useState<'github'|'upload'>('github');
  const [name, setName]           = useState('');
  const [repoUrl, setRepoUrl]     = useState('');
  const [branch, setBranch]       = useState('main');
  const [framework, setFramework] = useState('react');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [zones, setZones]         = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState<any>(null);
  const [subdomain, setSubdomain] = useState('');
  const [zonesLoading, setZonesLoading] = useState(false);
  const [zonesError, setZonesError]     = useState('');
  const [deploying, setDeploying] = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => { setZonesLoading(true); cloudflare.zones().then(setZones).catch(e => setZonesError(e.message)).finally(() => setZonesLoading(false)); }, []);
  useEffect(() => { if (name && !subdomain) setSubdomain(name.toLowerCase().replace(/[^a-z0-9]/g,'-')); }, [name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedZone) { setError('Pilih domain dari Cloudflare.'); return; }
    setError(''); setDeploying(true);
    try {
      const base = { name, framework, cf_zone_id: selectedZone.id, cf_domain: selectedZone.name, cf_subdomain: subdomain };
      let result;
      if (tab === 'github') {
        result = await projectsApi.createFromRepo({ ...base, repo_url: repoUrl, branch });
      } else {
        if (!uploadFiles.length) { setError('Pilih file dulu.'); setDeploying(false); return; }
        const fd = new FormData();
        Object.entries(base).forEach(([k,v]) => fd.append(k, v as string));
        uploadFiles.forEach(f => fd.append('files', f, f.name));
        const token = localStorage.getItem('deployflow_token');
        const res = await fetch('/api/projects', { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body: fd });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
        result = await res.json();
      }
      onCreated(result.project); onClose();
    } catch (err: any) { setError(err.message || 'Deploy gagal.'); setDeploying(false); }
  };

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md" onClick={onClose}>
      <motion.div initial={{ scale:0.95,opacity:0,y:20 }} animate={{ scale:1,opacity:1,y:0 }}
        className="w-full max-w-lg rounded-2xl bg-[#0C0F1C] border border-white/[0.09] shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500 to-purple-600" />
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div><h2 className="text-xl font-bold text-white">Deploy Project Baru</h2><p className="text-sm text-gray-500 mt-0.5">GitHub repo, ZIP, HTML, atau folder</p></div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors"><X size={18} /></button>
          </div>
          <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-6">
            {[{id:'github',icon:GitBranch,label:'GitHub Repo'},{id:'upload',icon:Upload,label:'Upload File/Folder'}].map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${tab===t.id ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-gray-500 hover:text-gray-300'}`}>
                <t.icon size={15} />{t.label}
              </button>
            ))}
          </div>
          {error && <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-4 text-sm text-red-400"><XCircle size={14} />{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Nama Project</label>
              <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="my-awesome-app" required pattern="^[a-zA-Z0-9][a-zA-Z0-9-_]*$"
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 text-sm transition-colors" />
            </div>
            {tab === 'github' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Repository URL</label>
                  <div className="relative">
                    <LinkIcon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input type="url" value={repoUrl} onChange={e=>setRepoUrl(e.target.value)} placeholder="https://github.com/user/repo" required
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 text-sm font-mono transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Branch</label>
                  <input type="text" value={branch} onChange={e=>setBranch(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white focus:outline-none focus:border-indigo-500/50 text-sm font-mono transition-colors" />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">File / Folder</label>
                <UploadZone files={uploadFiles} onChange={setUploadFiles} />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Framework</label>
              <select value={framework} onChange={e=>setFramework(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white focus:outline-none focus:border-indigo-500/50 text-sm appearance-none transition-colors">
                <option value="react">React (Vite)</option><option value="nextjs">Next.js</option><option value="vue">Vue</option>
                <option value="node">Node.js / Express</option><option value="python">Python (Flask/FastAPI/Django)</option><option value="static">Static HTML</option>
              </select>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Domain (dari Cloudflare)</label>
                {zonesLoading ? (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08]"><Loader2 size={14} className="animate-spin text-gray-500" /><span className="text-sm text-gray-500">Mengambil domains...</span></div>
                ) : zonesError ? (
                  <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20"><p className="text-xs text-red-400">⚠️ {zonesError}</p><p className="text-xs text-gray-600 mt-1">Set CF Token di Settings dulu</p></div>
                ) : (
                  <select value={selectedZone?.id||''} onChange={e=>setSelectedZone(zones.find(z=>z.id===e.target.value)||null)} required
                    className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white focus:outline-none focus:border-indigo-500/50 text-sm appearance-none transition-colors">
                    <option value="">-- Pilih Domain --</option>
                    {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                  </select>
                )}
              </div>
              {selectedZone && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Subdomain</label>
                  <div className="flex">
                    <input type="text" value={subdomain} onChange={e=>setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))} placeholder="app"
                      className="flex-1 px-4 py-2.5 rounded-l-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 text-sm font-mono transition-colors" />
                    <span className="px-4 py-2.5 rounded-r-xl bg-white/[0.02] border border-l-0 border-white/[0.08] text-sm text-gray-500 font-mono whitespace-nowrap">.{selectedZone.name}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1.5">URL: <span className="text-indigo-400 font-mono">https://{subdomain||'app'}.{selectedZone.name}</span></p>
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-gray-400 hover:bg-white/[0.08] transition-all">Batal</button>
              <button type="submit" disabled={deploying}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60 shadow-lg shadow-indigo-500/25 transition-all">
                {deploying ? <><Loader2 size={14} className="animate-spin"/>Deploying...</> : <><RefreshCw size={14}/>Deploy 🚀</>}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ProjectCard({ project, onNavigate, onRedeploy, onDelete, redeployingId, deletingId }: any) {
  const statusConfig: Record<string, any> = {
    ready:    { color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', icon: <CheckCircle2 size={12}/>, bar: 'bg-emerald-500' },
    building: { color: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',   icon: <Loader2 size={12} className="animate-spin"/>, bar: 'bg-indigo-500' },
    error:    { color: 'text-red-400 bg-red-400/10 border-red-400/20',             icon: <XCircle size={12}/>, bar: 'bg-red-500' },
  };
  const cfg = statusConfig[project.status] || { color: 'text-gray-400 bg-gray-400/10 border-gray-400/20', icon: <Clock size={12}/>, bar: 'bg-gray-500' };
  return (
    <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} whileHover={{ y:-3, transition:{ duration:0.18 } }}
      className="group relative rounded-2xl bg-[#0C0F1C] border border-white/[0.07] hover:border-white/[0.13] transition-all overflow-hidden">
      <div className={`h-0.5 w-full ${cfg.bar} opacity-60`} />
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
              <GitBranch size={17} className="text-indigo-400"/>
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors leading-tight">{project.name}</h3>
              <p className="text-xs text-gray-600 font-mono mt-0.5">{project.app_id}</p>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>{cfg.icon}<span>{project.status}</span></div>
        </div>
        <div className="space-y-2 mb-5">
          {project.domain && (
            <a href={`https://${project.domain}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-mono truncate group/link">
              <Globe size={11}/><span className="truncate">{project.domain}</span><ExternalLink size={10} className="opacity-0 group-hover/link:opacity-100 transition-opacity flex-shrink-0"/>
            </a>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className="px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.05]">{project.framework}</span>
            {project.port && <span className="font-mono">:{project.port}</span>}
          </div>
        </div>
        <div className="pt-4 border-t border-white/[0.05] flex items-center gap-1.5">
          <button onClick={() => onNavigate(project.id)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-500 hover:text-white hover:bg-white/[0.05] transition-all">
            Detail <ChevronRight size={12}/>
          </button>
          <button onClick={() => onRedeploy(project)} disabled={redeployingId===project.id || project.status==='building'}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-indigo-400 hover:bg-indigo-500/10 transition-all disabled:opacity-40">
            {redeployingId===project.id ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/>}Redeploy
          </button>
          <button onClick={() => onDelete(project)} disabled={deletingId===project.id}
            className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/5 transition-all disabled:opacity-40">
            {deletingId===project.id ? <Loader2 size={12} className="animate-spin"/> : <Trash2 size={12}/>}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function Dashboard({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [projectList, setProjectList]         = useState<Project[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [showNew, setShowNew]                 = useState(false);
  const [activeTab, setActiveTab]             = useState('projects');
  const [deletingId, setDeletingId]           = useState<number|null>(null);
  const [redeployingId, setRedeployingId]     = useState<number|null>(null);
  const navigate = useNavigate();

  const fetchProjects = async () => {
    try { setProjectList(await projectsApi.list() || []); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProjects(); }, []);
  useEffect(() => {
    const unsub = wsClient.on('deploy_status', (msg) => {
      setProjectList(prev => prev.map(p => p.app_id===msg.appId ? {...p,status:msg.status} : p));
    });
    return () => { unsub(); };
  }, []);

  const handleDelete = async (project: Project) => {
    if (!confirm(`Hapus "${project.name}"?`)) return;
    setDeletingId(project.id);
    try { await projectsApi.delete(project.id); setProjectList(prev=>prev.filter(p=>p.id!==project.id)); }
    catch (err: any) { alert(err.message); }
    finally { setDeletingId(null); }
  };

  const handleRedeploy = async (project: Project) => {
    setRedeployingId(project.id);
    try { await projectsApi.redeploy(project.id); setProjectList(prev=>prev.map(p=>p.id===project.id?{...p,status:'building'}:p)); }
    catch (err: any) { alert(err.message); }
    finally { setRedeployingId(null); }
  };

  const runningCount  = projectList.filter(p => p.status === 'ready').length;
  const buildingCount = projectList.filter(p => p.status === 'building').length;
  const errorCount    = projectList.filter(p => p.status === 'error').length;

  if (activeTab==='monitoring') return (
    <div className="min-h-screen bg-[#080B14] flex">
      <Sidebar user={user} onLogout={onLogout} activeTab={activeTab} setActiveTab={setActiveTab}/>
      <main className="flex-1 lg:ml-64"><Monitoring user={user}/></main>
    </div>
  );
  if (activeTab==='settings') return (
    <div className="min-h-screen bg-[#080B14] flex">
      <Sidebar user={user} onLogout={onLogout} activeTab={activeTab} setActiveTab={setActiveTab}/>
      <main className="flex-1 lg:ml-64"><Settings/></main>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#080B14] flex">
      <Sidebar user={user} onLogout={onLogout} activeTab={activeTab} setActiveTab={setActiveTab}/>
      <main className="flex-1 lg:ml-64">
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#080B14]/90 border-b border-white/[0.05] px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">Projects</h1>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-sm text-gray-600">{projectList.length} total</span>
                {runningCount > 0 && <span className="flex items-center gap-1 text-xs text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />{runningCount} online</span>}
                {buildingCount > 0 && <span className="flex items-center gap-1 text-xs text-indigo-400"><Loader2 size={10} className="animate-spin" />{buildingCount} building</span>}
                {errorCount > 0 && <span className="flex items-center gap-1 text-xs text-red-400"><XCircle size={10} />{errorCount} error</span>}
              </div>
            </div>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowNew(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-sm font-bold text-white hover:opacity-90 shadow-lg shadow-indigo-500/25 transition-all">
              <Plus size={16}/>Deploy Baru
            </motion.button>
          </div>
        </header>

        <div className="p-8">
          {loading ? (
            <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-indigo-400"/></div>
          ) : projectList.length === 0 ? (
            <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="flex flex-col items-center justify-center h-96 text-center">
              <div className="w-20 h-20 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center mb-6"><FolderOpen size={32} className="text-gray-700"/></div>
              <h3 className="text-xl font-semibold text-white mb-2">Belum ada project</h3>
              <p className="text-sm text-gray-600 mb-8 max-w-sm">Deploy dari GitHub, upload ZIP, HTML, atau folder.</p>
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={() => setShowNew(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-sm font-bold text-white shadow-lg shadow-indigo-500/25">
                <Plus size={16}/>Deploy Project Pertama
              </motion.button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {projectList.map((project, i) => (
                <motion.div key={project.id} transition={{ delay: i * 0.05 }}>
                  <ProjectCard project={project} onNavigate={(id: number) => navigate(`/project/${id}`)}
                    onRedeploy={handleRedeploy} onDelete={handleDelete} redeployingId={redeployingId} deletingId={deletingId} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {showNew && (
          <NewProjectModal onClose={() => setShowNew(false)}
            onCreated={(project) => { setProjectList(prev => [project, ...prev]); wsClient.subscribe(`deploy:${project.app_id}`); }} />
        )}
      </AnimatePresence>
    </div>
  );
}
EOF

echo "✅ Dashboard.tsx updated"

echo ""
echo "🔨 Building frontend..."
cd /root/panel/frontend && npm run build

echo ""
echo "🔄 Restarting PM2..."
cd /root/panel/backend && pm2 restart deployflow-panel

echo ""
echo "✅ Done! Website udah diupdate 🚀"
