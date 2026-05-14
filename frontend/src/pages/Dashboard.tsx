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
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-[#0D0F1A] border-r border-white/5 flex flex-col z-40 hidden lg:flex">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Terminal size={16} className="text-white" />
          </div>
          <span className="text-lg font-bold text-white">DeployFlow</span>
          <NotificationBell />
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {sidebarItems.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === item.id
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
            }`}>
            <item.icon size={18} />{item.label}
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
        <button onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/5 transition-all">
          <LogOut size={16} />Sign Out
        </button>
      </div>
    </aside>
  );
}

// ─── Upload Zone ──────────────────────────────────────────────────────────
function UploadZone({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const fileRef   = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const addFiles = (fl: FileList | null) => {
    if (!fl) return;
    onChange([...files, ...Array.from(fl)]);
  };

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
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed transition-all ${
          dragging ? 'border-indigo-500/60 bg-indigo-500/10'
          : files.length > 0 ? 'border-indigo-500/30 bg-indigo-500/5'
          : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
        }`}
      >
        <Upload size={22} className={files.length > 0 ? 'text-indigo-400' : 'text-gray-600'} />
        <div className="text-center">
          <p className="text-sm text-gray-400">Drag & drop file atau folder kesini</p>
          <p className="text-xs text-gray-600 mt-0.5">ZIP · HTML · CSS · JS · Folder project</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-400 hover:bg-white/10 transition-all">
            <FileText size={12} />Pilih File
          </button>
          <button type="button" onClick={() => folderRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-400 hover:bg-white/10 transition-all">
            <FolderOpen size={12} />Pilih Folder
          </button>
        </div>
        <input ref={fileRef} type="file" multiple className="hidden"
          accept=".zip,.html,.htm,.css,.js,.ts,.tsx,.jsx,.json,.png,.jpg,.svg,.ico"
          onChange={e => addFiles(e.target.files)} />
        {/* @ts-ignore */}
        <input ref={folderRef} type="file" multiple webkitdirectory="" directory="" className="hidden"
          onChange={e => addFiles(e.target.files)} />
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
                <button type="button" onClick={() => onChange(files.filter((_,j)=>j!==i))}
                  className="text-gray-700 hover:text-red-400 ml-1"><X size={11} /></button>
              </div>
            ))}
            {files.length > 15 && <div className="px-4 py-1.5 text-xs text-gray-600">+{files.length-15} lainnya...</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── New Project Modal ────────────────────────────────────────────────────
function NewProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: any) => void }) {
  const [tab, setTab]         = useState<'github'|'upload'>('github');
  const [name, setName]       = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch]   = useState('main');
  const [framework, setFramework] = useState('react');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [zones, setZones]     = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState<any>(null);
  const [subdomain, setSubdomain] = useState('');
  const [zonesLoading, setZonesLoading] = useState(false);
  const [zonesError, setZonesError]     = useState('');
  const [deploying, setDeploying]       = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    setZonesLoading(true);
    cloudflare.zones().then(setZones).catch(e => setZonesError(e.message)).finally(() => setZonesLoading(false));
  }, []);

  useEffect(() => {
    if (name && !subdomain) setSubdomain(name.toLowerCase().replace(/[^a-z0-9]/g,'-'));
  }, [name]);

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
      onCreated(result.project);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Deploy gagal.');
      setDeploying(false);
    }
  };

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}>
      <motion.div initial={{ scale:0.95,opacity:0,y:20 }} animate={{ scale:1,opacity:1,y:0 }}
        className="w-full max-w-lg rounded-2xl bg-[#0F1117] border border-white/10 p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Deploy Project Baru</h2>
            <p className="text-sm text-gray-500 mt-0.5">GitHub repo, ZIP, HTML, atau folder</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-gray-500"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-6">
          {[{id:'github',icon:GitBranch,label:'GitHub Repo'},{id:'upload',icon:Upload,label:'Upload File/Folder'}].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab===t.id ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-gray-500 hover:text-gray-300'
              }`}>
              <t.icon size={15} />{t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-4 text-sm text-red-400">
            <XCircle size={14} />{error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Nama Project</label>
            <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="my-awesome-app"
              required pattern="^[a-zA-Z0-9][a-zA-Z0-9-_]*$"
              className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 text-sm" />
          </div>

          {tab === 'github' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Repository URL</label>
                <div className="relative">
                  <LinkIcon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input type="url" value={repoUrl} onChange={e=>setRepoUrl(e.target.value)}
                    placeholder="https://github.com/user/repo" required
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 text-sm font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Branch</label>
                <input type="text" value={branch} onChange={e=>setBranch(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white focus:outline-none focus:border-indigo-500/50 text-sm font-mono" />
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
              className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white focus:outline-none focus:border-indigo-500/50 text-sm appearance-none">
              <option value="react">React (Vite)</option>
              <option value="nextjs">Next.js</option>
              <option value="vue">Vue</option>
              <option value="node">Node.js / Express</option>
              <option value="python">Python (Flask/FastAPI/Django)</option>
              <option value="static">Static HTML</option>
            </select>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Domain (dari Cloudflare)</label>
              {zonesLoading ? (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <Loader2 size={14} className="animate-spin text-gray-500" />
                  <span className="text-sm text-gray-500">Mengambil domains...</span>
                </div>
              ) : zonesError ? (
                <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-xs text-red-400">⚠️ {zonesError}</p>
                  <p className="text-xs text-gray-600 mt-1">Set CF Token di Settings dulu</p>
                </div>
              ) : (
                <select value={selectedZone?.id||''} onChange={e=>setSelectedZone(zones.find(z=>z.id===e.target.value)||null)} required
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white focus:outline-none focus:border-indigo-500/50 text-sm appearance-none">
                  <option value="">-- Pilih Domain --</option>
                  {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              )}
            </div>
            {selectedZone && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Subdomain</label>
                <div className="flex">
                  <input type="text" value={subdomain} onChange={e=>setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))}
                    placeholder="app"
                    className="flex-1 px-4 py-2.5 rounded-l-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 text-sm font-mono" />
                  <span className="px-4 py-2.5 rounded-r-xl bg-white/[0.02] border border-l-0 border-white/[0.08] text-sm text-gray-500 font-mono whitespace-nowrap">
                    .{selectedZone.name}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">URL: <span className="text-indigo-400">https://{subdomain||'app'}.{selectedZone.name}</span></p>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-gray-400 hover:bg-white/10">Batal</button>
            <button type="submit" disabled={deploying}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 shadow-lg shadow-indigo-500/25">
              {deploying ? <><Loader2 size={14} className="animate-spin"/>Deploying...</> : <><RefreshCw size={14}/>Deploy 🚀</>}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────
export default function Dashboard({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showNew, setShowNew]         = useState(false);
  const [activeTab, setActiveTab]     = useState('projects');
  const [deletingId, setDeletingId]   = useState<number|null>(null);
  const [redeployingId, setRedeployingId] = useState<number|null>(null);
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

  const statusColor = (s: string) => ({
    ready:    'text-green-400 bg-green-400/10 border-green-400/20',
    building: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
    error:    'text-red-400 bg-red-400/10 border-red-400/20',
  }[s] || 'text-gray-400 bg-gray-400/10 border-gray-400/20');

  const statusIcon = (s: string) => ({
    ready:    <CheckCircle2 size={13}/>,
    building: <Loader2 size={13} className="animate-spin"/>,
    error:    <XCircle size={13}/>,
  }[s] || <Clock size={13}/>);

  if (activeTab==='monitoring') return (
    <div className="min-h-screen bg-[#0A0E1A] flex">
      <Sidebar user={user} onLogout={onLogout} activeTab={activeTab} setActiveTab={setActiveTab}/>
      <main className="flex-1 lg:ml-64"><Monitoring user={user}/></main>
    </div>
  );

  if (activeTab==='settings') return (
    <div className="min-h-screen bg-[#0A0E1A] flex">
      <Sidebar user={user} onLogout={onLogout} activeTab={activeTab} setActiveTab={setActiveTab}/>
      <main className="flex-1 lg:ml-64"><Settings/></main>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex">
      <Sidebar user={user} onLogout={onLogout} activeTab={activeTab} setActiveTab={setActiveTab}/>
      <main className="flex-1 lg:ml-64">
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#0A0E1A]/80 border-b border-white/5 px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">Projects</h1>
              <p className="text-sm text-gray-500">{projectList.length} project</p>
            </div>
            <button onClick={() => setShowNew(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-sm font-semibold text-white hover:opacity-90 shadow-lg shadow-indigo-500/25">
              <Plus size={16}/>Deploy Baru
            </button>
          </div>
        </header>

        <div className="p-8">
          {loading ? (
            <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-indigo-400"/></div>
          ) : projectList.length === 0 ? (
            <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}
              className="flex flex-col items-center justify-center h-96 text-center">
              <div className="w-20 h-20 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center mb-6">
                <FolderOpen size={32} className="text-gray-600"/>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Belum ada project</h3>
              <p className="text-sm text-gray-500 mb-6">Deploy dari GitHub, upload ZIP, HTML, atau folder.</p>
              <button onClick={() => setShowNew(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-sm font-semibold text-white">
                <Plus size={16}/>Deploy Project
              </button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {projectList.map((project, i) => (
                <motion.div key={project.id} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}
                  whileHover={{y:-4,transition:{duration:0.2}}}
                  className="group relative p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center">
                        <GitBranch size={18} className="text-indigo-400"/>
                      </div>
                      <div>
                        <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors">{project.name}</h3>
                        <p className="text-xs text-gray-500 font-mono">{project.app_id}</p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusColor(project.status)}`}>
                      {statusIcon(project.status)}{project.status}
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    {project.domain && (
                      <a href={`https://${project.domain}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-mono truncate">
                        <Globe size={11}/>{project.domain}<ExternalLink size={10}/>
                      </a>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-600">
                      <span>{project.framework}</span>
                      {project.port && <span>:{project.port}</span>}
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/5 flex items-center gap-2">
                    <button onClick={() => navigate(`/project/${project.id}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all">
                      Detail<ChevronRight size={12}/>
                    </button>
                    <button onClick={() => handleRedeploy(project)}
                      disabled={redeployingId===project.id||project.status==='building'}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-indigo-400 hover:bg-indigo-500/10 transition-all disabled:opacity-40">
                      {redeployingId===project.id ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/>}Redeploy
                    </button>
                    <button onClick={() => handleDelete(project)} disabled={deletingId===project.id}
                      className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/5 transition-all disabled:opacity-40">
                      {deletingId===project.id ? <Loader2 size={12} className="animate-spin"/> : <Trash2 size={12}/>}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {showNew && (
          <NewProjectModal onClose={() => setShowNew(false)}
            onCreated={(project) => {
              setProjectList(prev => [project, ...prev]);
              wsClient.subscribe(`deploy:${project.app_id}`);
            }}/>
        )}
      </AnimatePresence>
    </div>
  );
}
