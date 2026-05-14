// src/pages/Dashboard.tsx
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, ExternalLink, Trash2, GitBranch, Clock, CheckCircle2, XCircle,
  Loader2, MoreVertical, ChevronRight, FolderOpen, History,
  Settings as SettingsIcon, LogOut, LayoutDashboard, Monitor,
  Upload, Link as LinkIcon, Terminal, Globe, RefreshCw, X, ChevronDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { projects as projectsApi, cloudflare, wsClient } from '../lib/api';
import Monitoring from './Monitoring';
import Settings   from './Settings';

interface Project {
  id: number;
  app_id: string;
  name: string;
  repo_url?: string;
  branch: string;
  framework: string;
  project_type?: string;
  domain?: string;
  port?: number;
  status: string;
  created_at: string;
  deployment_count?: number;
}

interface DashboardProps {
  user: any;
  onLogout: () => void;
}

const sidebarItems = [
  { icon: LayoutDashboard, label: 'Projects',   id: 'projects'   },
  { icon: Monitor,         label: 'Monitoring', id: 'monitoring' },
  { icon: History,         label: 'Deployments', id: 'deployments' },
  { icon: SettingsIcon,    label: 'Settings',   id: 'settings'   },
];

function Sidebar({ user, onLogout, activeTab, setActiveTab }: any) {
  const navigate = useNavigate();
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-[#0D0F1A] border-r border-white/5 flex flex-col z-40 hidden lg:flex">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Terminal size={16} className="text-white" />
          </div>
          <span className="text-lg font-bold text-white">DeployFlow</span>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {sidebarItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              activeTab === item.id
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
            }`}
          >
            <item.icon size={18} />
            {item.label}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.02] mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <span className="text-xs font-bold text-white">{user?.email?.[0]?.toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.email}</p>
            <p className="text-xs text-gray-500">Admin</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/5 transition-all"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

// ─── New Project Modal ────────────────────────────────────────────────────
function NewProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: any) => void }) {
  const [tab, setTab]         = useState<'github' | 'zip'>('github');
  const [name, setName]       = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch]   = useState('main');
  const [framework, setFramework] = useState('react');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zones, setZones]     = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState<any>(null);
  const [subdomain, setSubdomain] = useState('');
  const [zonesLoading, setZonesLoading] = useState(false);
  const [zonesError, setZonesError]     = useState('');
  const [deploying, setDeploying]       = useState(false);
  const [error, setError]     = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setZonesLoading(true);
    cloudflare.zones()
      .then(setZones)
      .catch(err => setZonesError(err.message))
      .finally(() => setZonesLoading(false));
  }, []);

  // Auto-fill subdomain dari nama project
  useEffect(() => {
    if (name && !subdomain) {
      setSubdomain(name.toLowerCase().replace(/[^a-z0-9]/g, '-'));
    }
  }, [name]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith('.zip')) setZipFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedZone) { setError('Pilih domain dari Cloudflare terlebih dahulu.'); return; }
    setError('');
    setDeploying(true);

    try {
      let result;
      const baseData = {
        name,
        framework,
        cf_zone_id: selectedZone.id,
        cf_domain:  selectedZone.name,
        cf_subdomain: subdomain || name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      };

      if (tab === 'github') {
        result = await projectsApi.createFromRepo({ ...baseData, repo_url: repoUrl, branch });
      } else {
        if (!zipFile) { setError('Upload file ZIP terlebih dahulu.'); setDeploying(false); return; }
        result = await projectsApi.createFromZip({ ...baseData, zip: zipFile });
      }

      onCreated(result.project);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Deploy gagal.');
      setDeploying(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg rounded-2xl bg-[#0F1117] border border-white/10 p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Deploy Project Baru</h2>
            <p className="text-sm text-gray-500 mt-0.5">Upload ZIP atau connect GitHub repo</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Source Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-6">
          {[
            { id: 'github', icon: GitBranch, label: 'GitHub Repo' },
            { id: 'zip',    icon: Upload,    label: 'Upload ZIP'  },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-5 text-sm text-red-400">
            <XCircle size={14} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Name */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Nama Project</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="my-awesome-app"
              required
              pattern="^[a-zA-Z0-9][a-zA-Z0-9-_]*$"
              className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 text-sm transition-all"
            />
          </div>

          {/* Source */}
          {tab === 'github' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Repository URL</label>
                <div className="relative">
                  <LinkIcon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input
                    type="url"
                    value={repoUrl}
                    onChange={e => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/user/repo"
                    required
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 text-sm font-mono transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Branch</label>
                <input
                  type="text"
                  value={branch}
                  onChange={e => setBranch(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white focus:outline-none focus:border-indigo-500/50 text-sm font-mono transition-all"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">File ZIP</label>
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                  zipFile
                    ? 'border-indigo-500/40 bg-indigo-500/5'
                    : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
                }`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={e => setZipFile(e.target.files?.[0] || null)}
                />
                <Upload size={24} className={zipFile ? 'text-indigo-400' : 'text-gray-600'} />
                {zipFile ? (
                  <div className="text-center">
                    <p className="text-sm font-medium text-indigo-300">{zipFile.name}</p>
                    <p className="text-xs text-gray-500">{(zipFile.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm text-gray-400">Drag & drop atau klik untuk pilih ZIP</p>
                    <p className="text-xs text-gray-600 mt-1">Maksimal 200MB</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Framework */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Framework</label>
            <select
              value={framework}
              onChange={e => setFramework(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white focus:outline-none focus:border-indigo-500/50 text-sm transition-all appearance-none cursor-pointer"
            >
              <option value="react">React (Vite)</option>
              <option value="nextjs">Next.js</option>
              <option value="vue">Vue</option>
              <option value="svelte">Svelte</option>
              <option value="node">Node.js / Express</option>
              <option value="static">Static HTML</option>
            </select>
          </div>

          {/* Domain */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Domain <span className="text-gray-600">(dari Cloudflare)</span>
              </label>
              {zonesLoading ? (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <Loader2 size={14} className="animate-spin text-gray-500" />
                  <span className="text-sm text-gray-500">Mengambil domains...</span>
                </div>
              ) : zonesError ? (
                <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-xs text-red-400">⚠️ {zonesError}</p>
                  <p className="text-xs text-gray-600 mt-1">Set CF Token di Settings terlebih dahulu</p>
                </div>
              ) : (
                <select
                  value={selectedZone?.id || ''}
                  onChange={e => setSelectedZone(zones.find(z => z.id === e.target.value) || null)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white focus:outline-none focus:border-indigo-500/50 text-sm transition-all appearance-none cursor-pointer"
                >
                  <option value="">-- Pilih Domain --</option>
                  {zones.map(z => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>
              )}
            </div>

            {selectedZone && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Subdomain</label>
                <div className="flex items-center gap-0">
                  <input
                    type="text"
                    value={subdomain}
                    onChange={e => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="app"
                    className="flex-1 px-4 py-2.5 rounded-l-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 text-sm font-mono transition-all"
                  />
                  <span className="px-4 py-2.5 rounded-r-xl bg-white/[0.02] border border-l-0 border-white/[0.08] text-sm text-gray-500 font-mono whitespace-nowrap">
                    .{selectedZone.name}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1.5">
                  URL: <span className="text-indigo-400">https://{subdomain || 'app'}.{selectedZone.name}</span>
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-gray-400 hover:bg-white/10 transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={deploying}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-sm font-semibold text-white hover:opacity-90 transition-all disabled:opacity-60 shadow-lg shadow-indigo-500/25"
            >
              {deploying ? (
                <><Loader2 size={14} className="animate-spin" /> Deploying...</>
              ) : (
                <><RefreshCw size={14} /> Deploy 🚀</>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────
export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showNew, setShowNew]         = useState(false);
  const [activeTab, setActiveTab]     = useState('projects');
  const [deletingId, setDeletingId]   = useState<number | null>(null);
  const [redeployingId, setRedeployingId] = useState<number | null>(null);
  const navigate = useNavigate();

  const fetchProjects = async () => {
    try {
      const data = await projectsApi.list();
      setProjectList(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  // WebSocket: listen status changes
  useEffect(() => {
    const unsub = wsClient.on('deploy_status', (msg) => {
      setProjectList(prev =>
        prev.map(p => p.app_id === msg.appId ? { ...p, status: msg.status } : p)
      );
    });
    return () => { unsub(); };
  }, []);

  const handleDelete = async (project: Project) => {
    if (!confirm(`Hapus project "${project.name}"? Ini akan stop PM2, hapus Nginx config, dan DNS Cloudflare.`)) return;
    setDeletingId(project.id);
    try {
      await projectsApi.delete(project.id);
      setProjectList(prev => prev.filter(p => p.id !== project.id));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleRedeploy = async (project: Project) => {
    setRedeployingId(project.id);
    try {
      await projectsApi.redeploy(project.id);
      setProjectList(prev => prev.map(p => p.id === project.id ? { ...p, status: 'building' } : p));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRedeployingId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':    return <CheckCircle2 size={14} className="text-green-400" />;
      case 'building': return <Loader2 size={14} className="text-indigo-400 animate-spin" />;
      case 'error':    return <XCircle size={14} className="text-red-400" />;
      default:         return <Clock size={14} className="text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':    return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'building': return 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20';
      case 'error':    return 'text-red-400 bg-red-400/10 border-red-400/20';
      default:         return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  if (activeTab === 'monitoring') {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex">
        <Sidebar user={user} onLogout={onLogout} activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 lg:ml-64"><Monitoring user={user} /></main>
      </div>
    );
  }

  if (activeTab === 'settings') {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex">
        <Sidebar user={user} onLogout={onLogout} activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 lg:ml-64"><Settings /></main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex">
      <Sidebar user={user} onLogout={onLogout} activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 lg:ml-64">
        {/* Header */}
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#0A0E1A]/80 border-b border-white/5 px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">Projects</h1>
              <p className="text-sm text-gray-500">{projectList.length} project aktif</p>
            </div>
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-lg shadow-indigo-500/25"
            >
              <Plus size={16} />
              Deploy Baru
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="p-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 size={32} className="animate-spin text-indigo-400" />
            </div>
          ) : projectList.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-96 text-center"
            >
              <div className="w-20 h-20 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center mb-6">
                <FolderOpen size={32} className="text-gray-600" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Belum ada project</h3>
              <p className="text-sm text-gray-500 mb-6 max-w-sm">
                Deploy project pertamamu — dari GitHub atau upload ZIP langsung.
              </p>
              <button
                onClick={() => setShowNew(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-sm font-semibold text-white"
              >
                <Plus size={16} />
                Deploy Project
              </button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {projectList.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="group relative p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center">
                        <GitBranch size={18} className="text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors">
                          {project.name}
                        </h3>
                        <p className="text-xs text-gray-500 font-mono">{project.app_id}</p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(project.status)}`}>
                      {getStatusIcon(project.status)}
                      {project.status}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="space-y-2 mb-4">
                    {project.domain && (
                      <a
                        href={`https://${project.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-mono truncate"
                      >
                        <Globe size={11} />
                        {project.domain}
                        <ExternalLink size={10} />
                      </a>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-600">
                      <span>{project.framework}</span>
                      {project.port && <span>:{project.port}</span>}
                      {project.deployment_count !== undefined && (
                        <span>{project.deployment_count} deploys</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-white/5 flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/project/${project.id}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                    >
                      Detail
                      <ChevronRight size={12} />
                    </button>
                    <button
                      onClick={() => handleRedeploy(project)}
                      disabled={redeployingId === project.id || project.status === 'building'}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-indigo-400 hover:bg-indigo-500/10 transition-all disabled:opacity-40"
                    >
                      {redeployingId === project.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <RefreshCw size={12} />}
                      Redeploy
                    </button>
                    <button
                      onClick={() => handleDelete(project)}
                      disabled={deletingId === project.id}
                      className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/5 transition-all disabled:opacity-40"
                    >
                      {deletingId === project.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <Trash2 size={12} />}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      <AnimatePresence>
        {showNew && (
          <NewProjectModal
            onClose={() => setShowNew(false)}
            onCreated={(project) => {
              setProjectList(prev => [project, ...prev]);
              // Subscribe ke log stream project baru
              wsClient.subscribe(`deploy:${project.app_id}`);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
