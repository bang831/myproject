// src/pages/Monitoring.tsx - Real-time system metrics via WebSocket
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Cpu, HardDrive, MemoryStick, Wifi, Activity,
  RefreshCw, Server, Clock, CheckCircle, AlertTriangle,
  Loader2, TrendingUp, WifiOff, Database,
} from 'lucide-react';
import { monitoring as monitoringApi, wsClient } from '../lib/api';

interface MonitoringProps { user: any; }

// ─── Circular Progress ────────────────────────────────────────────────────
function CircularProgress({ value, size = 110, strokeWidth = 8, label, sublabel }: any) {
  const radius      = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset      = circumference - (Math.min(value, 100) / 100) * circumference;

  const color =
    value >= 85 ? '#ef4444' :
    value >= 65 ? '#f59e0b' :
    '#22c55e';

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
          <motion.circle
            cx={size/2} cy={size/2} r={radius} fill="none"
            stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{Math.round(value)}%</span>
        </div>
      </div>
      {(label || sublabel) && (
        <div className="mt-2 text-center">
          {label    && <p className="text-sm font-medium text-white">{label}</p>}
          {sublabel && <p className="text-xs text-gray-500 mt-0.5">{sublabel}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Mini bar chart (last N readings) ────────────────────────────────────
function SparkBar({ data, color = '#6366f1', height = 36 }: any) {
  if (!data.length) return null;
  const max   = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-px" style={{ height }}>
      {data.map((v: number, i: number) => (
        <div
          key={i}
          className="flex-1 rounded-sm min-h-[2px]"
          style={{
            height:          `${(v / max) * 100}%`,
            backgroundColor: color,
            opacity:         0.5 + (v / max) * 0.5,
          }}
        />
      ))}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'text-indigo-400', children }: any) {
  return (
    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className={color} />
        <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</span>
      </div>
      {value !== undefined && (
        <p className={`text-2xl font-bold ${color} mb-1`}>{value}</p>
      )}
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
      {children}
    </div>
  );
}

// ─── Main Monitoring Component ─────────────────────────────────────────────
export default function Monitoring({ user }: MonitoringProps) {
  const [metrics, setMetrics]     = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [wsOk, setWsOk]           = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'storage' | 'processes'>('overview');

  // History for sparklines
  const [cpuHistory, setCpuHistory]   = useState<number[]>([]);
  const [memHistory, setMemHistory]   = useState<number[]>([]);
  const [netRxHistory, setNetRxHistory] = useState<number[]>([]);

  // Initial fetch via REST
  const fetchOnce = useCallback(async () => {
    try {
      const data = await monitoringApi.get();
      applyMetrics(data);
    } catch (err) {
      console.error('[Monitoring]', err);
    } finally {
      setLoading(false);
    }
  }, []);

  function applyMetrics(data: any) {
    setMetrics(data);
    setLastUpdate(new Date());
    setCpuHistory(prev => [...prev.slice(-59), data.cpu?.usagePercent ?? 0]);
    setMemHistory(prev => [...prev.slice(-59), data.memory?.usagePercent ?? 0]);
    setNetRxHistory(prev => [...prev.slice(-59), data.network?.rxMBs ?? 0]);
  }

  useEffect(() => {
    fetchOnce();

    // Subscribe ke realtime metrics channel via WebSocket
    wsClient.subscribe('metrics');

    const unsubMetrics = wsClient.on('metrics', (data) => {
      applyMetrics(data);
    });

    const unsubConn = wsClient.on('_connected', () => setWsOk(true));
    const unsubDisc = wsClient.on('_disconnected', () => setWsOk(false));

    return () => {
      unsubMetrics();
      unsubConn();
      unsubDisc();
      wsClient.unsubscribe('metrics');
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={36} className="animate-spin text-indigo-400" />
          <p className="text-sm text-gray-500">Mengambil data sistem...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle size={40} className="text-yellow-400 mx-auto mb-3" />
          <p className="text-white font-medium mb-1">Gagal mengambil metrics</p>
          <p className="text-sm text-gray-500 mb-4">Pastikan backend berjalan.</p>
          <button onClick={fetchOnce} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/20 text-indigo-300 text-sm hover:bg-indigo-500/30 transition-all mx-auto">
            <RefreshCw size={14} />
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  const cpu = metrics.cpu     || {};
  const mem = metrics.memory  || {};
  const net = metrics.network || {};
  const summary = metrics.summary || {};

  return (
    <div className="min-h-screen bg-[#0A0E1A] pb-12">
      {/* Top bar */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#0A0E1A]/80 border-b border-white/5 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Activity size={20} className="text-indigo-400" />
              System Monitor
            </h1>
            <p className="text-sm text-gray-500">
              {metrics.hostname} · {metrics.platform}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdate && (
              <p className="text-xs text-gray-600">
                Update: {lastUpdate.toLocaleTimeString('id-ID')}
              </p>
            )}
            <div className={`flex items-center gap-1.5 text-xs font-medium ${wsOk ? 'text-green-400' : 'text-gray-600'}`}>
              {wsOk ? <Wifi size={14} /> : <WifiOff size={14} />}
              {wsOk ? 'Realtime' : 'Polling'}
            </div>
            <button
              onClick={fetchOnce}
              className="p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mt-4">
          {[
            { id: 'overview',   label: 'Overview'  },
            { id: 'storage',    label: 'Storage'   },
            { id: 'processes',  label: 'Processes (PM2)' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/25'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 py-8 space-y-6">

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Server,       label: 'Total Projects',   value: summary.totalProjects ?? '-',    color: 'text-indigo-400' },
                { icon: CheckCircle,  label: 'Running',          value: summary.runningProjects ?? '-',  color: 'text-green-400'  },
                { icon: AlertTriangle,label: 'Error',            value: summary.errorProjects ?? '-',    color: 'text-red-400'    },
                { icon: Database,     label: 'Total Deploys',    value: summary.totalDeployments ?? '-', color: 'text-purple-400' },
              ].map(s => (
                <StatCard key={s.label} {...s} />
              ))}
            </div>

            {/* Big 3 gauges */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* CPU */}
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-4">
                  <Cpu size={16} className="text-indigo-400" />
                  <span className="text-sm font-medium text-white">CPU</span>
                  <span className="ml-auto text-xs text-gray-500">{cpu.cores} cores</span>
                </div>
                <div className="flex justify-center mb-4">
                  <CircularProgress value={cpu.usagePercent ?? 0} label={`${cpu.usagePercent ?? 0}%`} sublabel={cpu.model?.split('@')[0]?.trim() || ''} />
                </div>
                <SparkBar data={cpuHistory} color="#6366f1" height={36} />
                <p className="text-xs text-gray-600 mt-2">Load avg: {(cpu.loadAverage || []).join(' · ')}</p>
              </div>

              {/* Memory */}
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-4">
                  <MemoryStick size={16} className="text-purple-400" />
                  <span className="text-sm font-medium text-white">Memory</span>
                  <span className="ml-auto text-xs text-gray-500">{(mem.totalMB / 1024).toFixed(1)} GB</span>
                </div>
                <div className="flex justify-center mb-4">
                  <CircularProgress
                    value={mem.usagePercent ?? 0}
                    label={`${(mem.usedMB / 1024).toFixed(1)} GB`}
                    sublabel={`of ${(mem.totalMB / 1024).toFixed(1)} GB`}
                  />
                </div>
                <SparkBar data={memHistory} color="#a855f7" height={36} />
                {mem.swapTotalMB > 0 && (
                  <p className="text-xs text-gray-600 mt-2">
                    Swap: {mem.swapUsedMB} / {mem.swapTotalMB} MB
                  </p>
                )}
              </div>

              {/* Network */}
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-4">
                  <Wifi size={16} className="text-cyan-400" />
                  <span className="text-sm font-medium text-white">Network</span>
                  <span className="ml-auto text-xs text-gray-500">{net.iface}</span>
                </div>
                <div className="space-y-4 mt-2">
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>↓ Download</span>
                      <span className="text-cyan-400 font-mono">{net.rxMBs ?? 0} MB/s</span>
                    </div>
                    <SparkBar data={netRxHistory} color="#22d3ee" height={28} />
                  </div>
                  <div className="flex justify-between text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Total RX</p>
                      <p className="text-white font-mono">{net.rxTotal}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Total TX</p>
                      <p className="text-white font-mono">{net.txTotal}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Clock size={11} />
                    Uptime: {metrics.uptime}
                  </div>
                </div>
              </div>
            </div>

            {/* Per-core breakdown */}
            {cpu.perCore?.length > 0 && (
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                  <Cpu size={15} className="text-indigo-400" />
                  CPU Per Core
                </h3>
                <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                  {cpu.perCore.map((c: any) => (
                    <div key={c.core} className="text-center">
                      <div className="relative w-full aspect-square mb-1">
                        <svg viewBox="0 0 36 36" className="w-full -rotate-90">
                          <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                          <motion.circle
                            cx="18" cy="18" r="15" fill="none"
                            stroke={c.load >= 85 ? '#ef4444' : c.load >= 65 ? '#f59e0b' : '#6366f1'}
                            strokeWidth="3" strokeLinecap="round"
                            strokeDasharray="94.25"
                            animate={{ strokeDashoffset: 94.25 - (c.load / 100) * 94.25 }}
                            transition={{ duration: 0.6 }}
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                          {Math.round(c.load)}%
                        </span>
                      </div>
                      <p className="text-[9px] text-gray-600">Core {c.core}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Storage ── */}
        {activeTab === 'storage' && (
          <div className="space-y-4">
            {(metrics.storage || []).map((disk: any, i: number) => (
              <div key={i} className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <HardDrive size={18} className="text-emerald-400" />
                    <div>
                      <p className="text-sm font-medium text-white font-mono">{disk.mount}</p>
                      <p className="text-xs text-gray-500">{disk.device} · {disk.filesystem}</p>
                    </div>
                  </div>
                  <span className={`text-lg font-bold ${disk.usagePercent >= 85 ? 'text-red-400' : disk.usagePercent >= 65 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                    {disk.usagePercent}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${disk.usagePercent >= 85 ? 'bg-red-500' : disk.usagePercent >= 65 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                    animate={{ width: `${disk.usagePercent}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
                <div className="flex justify-between mt-3 text-xs text-gray-500">
                  <span>Used: <span className="text-white">{disk.usedGB} GB</span></span>
                  <span>Free: <span className="text-white">{disk.freeGB} GB</span></span>
                  <span>Total: <span className="text-white">{disk.totalGB} GB</span></span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Processes (PM2) ── */}
        {activeTab === 'processes' && (
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
              <span className="text-sm font-medium text-white">PM2 Apps</span>
              <span className="text-xs text-gray-500">{(metrics.pm2Apps || []).length} proses</span>
            </div>
            {(metrics.pm2Apps || []).length === 0 ? (
              <div className="py-12 text-center text-gray-600 text-sm">
                Tidak ada PM2 process yang berjalan.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {/* Header */}
                <div className="grid grid-cols-6 px-5 py-2 text-xs text-gray-600 uppercase tracking-wider">
                  <span className="col-span-2">Name</span>
                  <span>PID</span>
                  <span>Status</span>
                  <span>CPU</span>
                  <span>Mem</span>
                </div>
                {metrics.pm2Apps.map((app: any, i: number) => (
                  <div key={i} className="grid grid-cols-6 px-5 py-3 text-sm hover:bg-white/[0.02] transition-colors">
                    <span className="col-span-2 text-white font-mono truncate">{app.name}</span>
                    <span className="text-gray-500 font-mono">{app.pid}</span>
                    <span className={`font-medium ${app.status === 'online' ? 'text-green-400' : 'text-red-400'}`}>
                      {app.status}
                    </span>
                    <span className={app.cpu > 50 ? 'text-yellow-400' : 'text-gray-400'}>
                      {app.cpu.toFixed(1)}%
                    </span>
                    <span className="text-gray-400">{app.memMB} MB</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
