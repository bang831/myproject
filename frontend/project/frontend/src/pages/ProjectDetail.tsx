// src/pages/ProjectDetail.tsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ExternalLink, GitBranch, Clock, CheckCircle2, XCircle,
  Loader2, RefreshCw, Terminal, Activity, Globe, Settings,
  Wifi, WifiOff, ChevronDown,
} from 'lucide-react';
import { projects as projectsApi, deployments as deploymentsApi, wsClient } from '../lib/api';

interface Deployment {
  id: number;
  project_id: number;
  status: string;
  commit_hash: string;
  commit_message: string;
  logs: string;
  duration: number;
  created_at: string;
}

export default function ProjectDetail({ user }: { user: any }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject]         = useState<any>(null);
  const [deploymentList, setDeploymentList] = useState<Deployment[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState<'overview' | 'deployments' | 'logs'>('overview');
  const [isRedeploying, setIsRedeploying] = useState(false);

  // Live log state
  const [liveLog, setLiveLog]         = useState<string[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [isStreaming, setIsStreaming]  = useState(false);
  const [pm2Logs, setPm2Logs]         = useState('');
  const [pm2Loading, setPm2Loading]   = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);

  // ── Fetch data ─────────────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      const [projData, depData] = await Promise.all([
        projectsApi.get(id!),
        deploymentsApi.list(id),
      ]);
      setProject(projData);
      setDeploymentList(depData || []);

      // Kalau project masih building, mulai stream log
      if (projData.status === 'building') {
        setIsStreaming(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  // ── WebSocket subscriptions ─────────────────────────────────────────────
  useEffect(() => {
    if (!project?.app_id) return;

    const appId = project.app_id;

    // Subscribe ke log channel
    wsClient.subscribe(`deploy:${appId}`);

    const unsubLog = wsClient.on(`deploy:${appId}`, (msg) => {
      setLiveLog(prev => [...prev, msg.line]);
      setIsStreaming(true);
      // Auto scroll
      setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });

    const unsubStatus = wsClient.on(`status:${appId}`, (msg) => {
      setProject((prev: any) => prev ? { ...prev, status: msg.status } : prev);
      if (msg.status === 'ready' || msg.status === 'error') {
        setIsStreaming(false);
        // Refresh deployments setelah selesai
        deploymentsApi.list(id).then(setDeploymentList).catch(() => {});
      }
    });

    const unsubConn = wsClient.on('_connected', () => setWsConnected(true));
    const unsubDisc = wsClient.on('_disconnected', () => setWsConnected(false));

    return () => {
      unsubLog();
      unsubStatus();
      unsubConn();
      unsubDisc();
      wsClient.unsubscribe(`deploy:${appId}`);
    };
  }, [project?.app_id]);

  // ── PM2 live logs fetch ─────────────────────────────────────────────────
  const fetchPm2Logs = async () => {
    setPm2Loading(true);
    try {
      const data = await projectsApi.logs(id!, 200);
      setPm2Logs(data.logs || 'Tidak ada logs.');
    } catch {
      setPm2Logs('Gagal mengambil logs.');
    } finally {
      setPm2Loading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'logs' && project) {
      fetchPm2Logs();
    }
  }, [activeTab, project]);

  // ── Redeploy ────────────────────────────────────────────────────────────
  const handleRedeploy = async () => {
    setIsRedeploying(true);
    setLiveLog([]);
    setIsStreaming(true);
    try {
      await projectsApi.redeploy(id!);
      setProject((prev: any) => prev ? { ...prev, status: 'building' } : prev);
      // Switch ke tab logs biar keliatan
      setActiveTab('logs');
    } catch (err: any) {
      alert(err.message);
      setIsStreaming(false);
    } finally {
      setIsRedeploying(false);
    }
  };

  // ── Status badge ────────────────────────────────────────────────────────
  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      ready:    'text-green-400 bg-green-400/10 border-green-400/20',
      building: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
      error:    'text-red-400 bg-red-400/10 border-red-400/20',
    };
    const icons: Record<string, JSX.Element> = {
      ready:    <CheckCircle2 size={12} />,
      building: <Loader2 size={12} className="animate-spin" />,
      error:    <XCircle size={12} />,
    };
    return (
      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${classes[status] || 'text-gray-400 bg-gray-400/10 border-gray-400/20'}`}>
        {icons[status] || <Clock size={12} />}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Project tidak ditemukan</h2>
          <button onClick={() => navigate('/dashboard')} className="text-indigo-400 hover:text-indigo-300">
            ← Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A]">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#0A0E1A]/80 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center">
                <GitBranch size={18} className="text-indigo-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-3">
                  {project.name}
                  {getStatusBadge(project.status)}
                  {/* WS indicator */}
                  <span title={wsConnected ? 'Realtime connected' : 'Reconnecting...'}>
                    {wsConnected
                      ? <Wifi size={13} className="text-green-500" />
                      : <WifiOff size={13} className="text-gray-600" />}
                  </span>
                </h1>
                <p className="text-xs text-gray-500 font-mono">{project.app_id}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {project.domain && (
                <a
                  href={`https://${project.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  <Globe size={14} />
                  Visit
                  <ExternalLink size={12} />
                </a>
              )}
              <button
                onClick={handleRedeploy}
                disabled={isRedeploying || project.status === 'building'}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-sm font-medium text-white hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20"
              >
                {isRedeploying ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Redeploy
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-white/5">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex gap-1">
            {[
              { id: 'overview',     label: 'Overview',     icon: Activity  },
              { id: 'deployments',  label: 'Deployments',  icon: Clock     },
              { id: 'logs',         label: 'Logs',         icon: Terminal  },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
                {tab.id === 'logs' && isStreaming && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-8 py-8">

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: 'Status',       value: project.status,                     icon: CheckCircle2, color: project.status === 'ready' ? 'text-green-400' : 'text-indigo-400' },
                { label: 'Deployments',  value: String(deploymentList.length),      icon: Clock,        color: 'text-indigo-400' },
                { label: 'Framework',    value: project.framework || '-',           icon: Settings,     color: 'text-purple-400' },
                { label: 'Port',         value: project.port ? `:${project.port}` : '-', icon: Globe, color: 'text-cyan-400' },
              ].map(stat => (
                <div key={stat.label} className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-2">
                    <stat.icon size={14} className={stat.color} />
                    <span className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</span>
                  </div>
                  <p className={`text-lg font-semibold ${stat.color} font-mono`}>{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <h3 className="text-sm font-semibold text-white mb-4">Konfigurasi</h3>
                <dl className="space-y-2">
                  {[
                    ['App ID',       project.app_id],
                    ['Branch',       project.branch || 'main'],
                    ['Project Type', project.project_type || 'unknown'],
                    ['Domain',       project.domain || '-'],
                    ['Dibuat',       new Date(project.created_at).toLocaleString('id-ID')],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <dt className="text-sm text-gray-500">{k}</dt>
                      <dd className="text-sm text-white font-mono truncate max-w-[200px]">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <h3 className="text-sm font-semibold text-white mb-4">Deployment Terakhir</h3>
                {deploymentList.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(deploymentList[0].status)}
                      <span className="text-xs text-gray-500">
                        {new Date(deploymentList[0].created_at).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 font-mono bg-black/30 rounded-lg px-3 py-2">
                      {deploymentList[0].commit_message}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {deploymentList[0].commit_hash && (
                        <span className="font-mono">{deploymentList[0].commit_hash.slice(0, 7)}</span>
                      )}
                      {deploymentList[0].duration > 0 && (
                        <span>{deploymentList[0].duration}s</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">Belum ada deployment.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Deployments ── */}
        {activeTab === 'deployments' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {deploymentList.length === 0 ? (
              <div className="text-center py-16">
                <Clock size={40} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-500">Belum ada deployment.</p>
              </div>
            ) : (
              deploymentList.map((dep, i) => (
                <motion.div
                  key={dep.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-all"
                >
                  <div className="shrink-0">
                    {dep.status === 'building' ? <Loader2 size={18} className="text-indigo-400 animate-spin" />
                     : dep.status === 'ready'   ? <CheckCircle2 size={18} className="text-green-400" />
                     : <XCircle size={18} className="text-red-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{dep.commit_message}</p>
                    {dep.commit_hash && (
                      <p className="text-xs text-gray-500 font-mono">{dep.commit_hash.slice(0, 7)}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {dep.duration > 0 && <p className="text-xs text-gray-400">{dep.duration}s</p>}
                    <p className="text-xs text-gray-600">{new Date(dep.created_at).toLocaleDateString('id-ID')}</p>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        )}

        {/* ── Logs ── */}
        {activeTab === 'logs' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

            {/* Live Deploy Log (saat building) */}
            {(isStreaming || liveLog.length > 0) && (
              <div className="rounded-2xl bg-[#0D1117] border border-indigo-500/20 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-indigo-500/5">
                  <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-indigo-400" />
                    <span className="text-xs font-medium text-indigo-300">Deploy Log (Live)</span>
                    {isStreaming && (
                      <span className="flex items-center gap-1 text-xs text-indigo-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                        streaming...
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setLiveLog([])}
                    className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="p-5 font-mono text-xs leading-relaxed max-h-[400px] overflow-y-auto">
                  {liveLog.length === 0 ? (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Loader2 size={12} className="animate-spin" />
                      Menunggu log...
                    </div>
                  ) : (
                    liveLog.map((line, i) => (
                      <div
                        key={i}
                        className={
                          line.includes('✅') || line.includes('berhasil') ? 'text-green-400' :
                          line.includes('❌') || line.includes('GAGAL') || line.includes('error') ? 'text-red-400' :
                          line.startsWith('$') || line.includes('npm') ? 'text-indigo-300' :
                          line.includes('🚀') || line.includes('🎉') ? 'text-yellow-400' :
                          'text-gray-400'
                        }
                      >
                        {line}
                      </div>
                    ))
                  )}
                  <div ref={logEndRef} />
                </div>
              </div>
            )}

            {/* PM2 / Runtime Logs */}
            <div className="rounded-2xl bg-[#0D1117]/80 border border-white/10 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/20">
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-gray-500" />
                  <span className="text-xs text-gray-500">
                    {project.pm2_name ? `PM2 Logs — ${project.pm2_name}` : 'Runtime Logs'}
                  </span>
                </div>
                <button
                  onClick={fetchPm2Logs}
                  disabled={pm2Loading}
                  className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-400 transition-colors"
                >
                  {pm2Loading
                    ? <Loader2 size={12} className="animate-spin" />
                    : <RefreshCw size={12} />}
                  Refresh
                </button>
              </div>
              <div className="p-5 font-mono text-xs text-gray-400 leading-relaxed max-h-[500px] overflow-y-auto whitespace-pre-wrap">
                {pm2Loading ? (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Loader2 size={12} className="animate-spin" />
                    Mengambil logs...
                  </div>
                ) : (
                  pm2Logs || <span className="text-gray-600">Tidak ada logs.</span>
                )}
              </div>
            </div>

          </motion.div>
        )}

      </div>
    </div>
  );
}
