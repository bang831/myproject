import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Cpu, HardDrive, Activity, RefreshCw, Server,
  CheckCircle, AlertTriangle, Loader2, Wifi, WifiOff,
  Database, Battery, BatteryCharging, ArrowDown, ArrowUp,
} from 'lucide-react';
import { monitoring as monitoringApi, wsClient } from '../lib/api';

interface MonitoringProps { user: any; }

function CircularProgress({ value, size = 110, strokeWidth = 8, label, sublabel }: any) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(value, 100) / 100) * circumference;
  const color = value >= 85 ? '#ef4444' : value >= 65 ? '#f59e0b' : '#22c55e';
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
          <motion.circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color}
            strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference}
            animate={{ strokeDashoffset: offset }} transition={{ duration: 0.8, ease: 'easeOut' }} />
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

function SparkBar({ data, color = '#6366f1', height = 36 }: any) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-px" style={{ height }}>
      {data.map((v: number, i: number) => (
        <div key={i} className="flex-1 rounded-sm min-h-[2px]"
          style={{ height: `${(v / max) * 100}%`, backgroundColor: color, opacity: 0.5 + (v / max) * 0.5 }} />
      ))}
    </div>
  );
}

export default function Monitoring({ user }: MonitoringProps) {
  const [metrics, setMetrics]   = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [wsOk, setWsOk]         = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [activeTab, setActiveTab]   = useState<'overview'|'storage'|'processes'>('overview');
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memHistory, setMemHistory] = useState<number[]>([]);

  const fetchOnce = useCallback(async () => {
    try {
      const data = await monitoringApi.get();
      applyMetrics(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  function applyMetrics(data: any) {
    setMetrics(data);
    setLastUpdate(new Date());
    setCpuHistory(prev => [...prev.slice(-59), data.cpu?.usagePercent ?? 0]);
    setMemHistory(prev => [...prev.slice(-59), data.memory?.usagePercent ?? 0]);
  }

  useEffect(() => {
    fetchOnce();
    wsClient.subscribe('metrics');
    const unsubMetrics = wsClient.on('metrics', applyMetrics);
    const unsubConn    = wsClient.on('_connected', () => setWsOk(true));
    const unsubDisc    = wsClient.on('_disconnected', () => setWsOk(false));
    return () => { unsubMetrics(); unsubConn(); unsubDisc(); wsClient.unsubscribe('metrics'); };
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
      <Loader2 size={36} className="animate-spin text-indigo-400" />
    </div>
  );

  if (!metrics) return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
      <div className="text-center">
        <AlertTriangle size={40} className="text-yellow-400 mx-auto mb-3" />
        <p className="text-white font-medium mb-4">Gagal ambil metrics</p>
        <button onClick={fetchOnce} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/20 text-indigo-300 text-sm mx-auto">
          <RefreshCw size={14} />Coba Lagi
        </button>
      </div>
    </div>
  );

  const cpu     = metrics.cpu     || {};
  const mem     = metrics.memory  || {};
  const diskIO  = metrics.diskIO  || {};
  const battery = metrics.battery;
  const summary = metrics.summary || {};

  return (
    <div className="min-h-screen bg-[#0A0E1A] pb-12">
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#0A0E1A]/80 border-b border-white/5 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Activity size={20} className="text-indigo-400" />System Monitor
            </h1>
            <p className="text-sm text-gray-500">{metrics.hostname} · {metrics.platform} · Uptime: {metrics.uptime}</p>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdate && <p className="text-xs text-gray-600">{lastUpdate.toLocaleTimeString('id-ID')}</p>}
            {battery && (
              <div className={`flex items-center gap-1.5 text-xs font-medium ${battery.charging ? 'text-green-400' : battery.percent < 20 ? 'text-red-400' : 'text-gray-400'}`}>
                {battery.charging ? <BatteryCharging size={16}/> : <Battery size={16}/>}
                {battery.percent}%
              </div>
            )}
            <div className={`flex items-center gap-1.5 text-xs ${wsOk ? 'text-green-400' : 'text-gray-600'}`}>
              {wsOk ? <Wifi size={14}/> : <WifiOff size={14}/>}
              {wsOk ? 'Realtime' : 'Polling'}
            </div>
            <button onClick={fetchOnce} className="p-2 rounded-lg hover:bg-white/5 text-gray-500">
              <RefreshCw size={16}/>
            </button>
          </div>
        </div>
        <div className="flex gap-1 mt-4">
          {[{id:'overview',label:'Overview'},{id:'storage',label:'Storage'},{id:'processes',label:'Processes'}].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab===tab.id ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/25' : 'text-gray-500 hover:text-gray-300'
              }`}>{tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 py-8 space-y-6">

        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Server,        label: 'Projects',    value: summary.totalProjects ?? '-',    color: 'text-indigo-400' },
                { icon: CheckCircle,   label: 'Running',     value: summary.runningProjects ?? '-',  color: 'text-green-400'  },
                { icon: AlertTriangle, label: 'Error',       value: summary.errorProjects ?? '-',    color: 'text-red-400'    },
                { icon: Database,      label: 'Deployments', value: summary.totalDeployments ?? '-', color: 'text-purple-400' },
              ].map(s => (
                <div key={s.label} className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-2">
                    <s.icon size={14} className={s.color}/>
                    <span className="text-xs text-gray-500 uppercase tracking-wider">{s.label}</span>
                  </div>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-4">
                  <Cpu size={16} className="text-indigo-400"/>
                  <span className="text-sm font-medium text-white">CPU</span>
                  <span className="ml-auto text-xs text-gray-500">{cpu.cores} cores</span>
                </div>
                <div className="flex justify-center mb-4">
                  <CircularProgress value={cpu.usagePercent ?? 0}/>
                </div>
                <SparkBar data={cpuHistory} color="#6366f1" height={36}/>
                <p className="text-xs text-gray-600 mt-2 truncate">{cpu.model}</p>
                <p className="text-xs text-gray-600 mt-1">Load avg: {(cpu.loadAverage||[]).join(' · ')}</p>
              </div>

              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-4">
                  <Server size={16} className="text-purple-400"/>
                  <span className="text-sm font-medium text-white">Memory</span>
                  <span className="ml-auto text-xs text-gray-500">{(mem.totalMB/1024).toFixed(1)} GB</span>
                </div>
                <div className="flex justify-center mb-4">
                  <CircularProgress value={mem.usagePercent ?? 0}
                    label={`${(mem.usedMB/1024).toFixed(1)} GB`}
                    sublabel={`of ${(mem.totalMB/1024).toFixed(1)} GB`}/>
                </div>
                <SparkBar data={memHistory} color="#a855f7" height={36}/>
                {mem.swapTotalMB > 0 && <p className="text-xs text-gray-600 mt-2">Swap: {mem.swapUsedMB}/{mem.swapTotalMB} MB</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {battery && (
                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-4">
                    {battery.charging ? <BatteryCharging size={16} className="text-green-400"/> : <Battery size={16} className="text-yellow-400"/>}
                    <span className="text-sm font-medium text-white">Baterai HP</span>
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${battery.charging ? 'bg-green-400/10 text-green-400' : 'bg-gray-400/10 text-gray-400'}`}>
                      {battery.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-5xl font-bold text-white">{battery.percent}%</div>
                    <div className="flex-1">
                      <div className="w-full h-4 rounded-full bg-white/5 overflow-hidden">
                        <motion.div className={`h-full rounded-full ${battery.percent < 20 ? 'bg-red-500' : battery.charging ? 'bg-green-500' : 'bg-yellow-500'}`}
                          animate={{ width: `${battery.percent}%` }} transition={{ duration: 1 }}/>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {battery.charging ? '⚡ Sedang charging' : battery.percent < 20 ? '⚠️ Baterai rendah!' : '🔋 Tidak charging'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-4">
                  <HardDrive size={16} className="text-emerald-400"/>
                  <span className="text-sm font-medium text-white">Disk I/O</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Read',  value: `${diskIO.readMBs ?? 0} MB/s`,  icon: ArrowDown, color: 'text-blue-400',   sub: `${diskIO.readOps ?? 0} IOPS`  },
                    { label: 'Write', value: `${diskIO.writeMBs ?? 0} MB/s`, icon: ArrowUp,   color: 'text-orange-400', sub: `${diskIO.writeOps ?? 0} IOPS` },
                  ].map(s => (
                    <div key={s.label} className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="flex items-center gap-1.5 mb-2">
                        <s.icon size={13} className={s.color}/>
                        <span className="text-xs text-gray-500">{s.label}</span>
                      </div>
                      <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-gray-600 mt-1">{s.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {cpu.perCore?.length > 0 && (
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                  <Cpu size={15} className="text-indigo-400"/>CPU Per Core
                </h3>
                <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                  {cpu.perCore.map((c: any) => (
                    <div key={c.core} className="text-center">
                      <div className="relative w-full aspect-square mb-1">
                        <svg viewBox="0 0 36 36" className="w-full -rotate-90">
                          <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3"/>
                          <motion.circle cx="18" cy="18" r="15" fill="none"
                            stroke={c.load >= 85 ? '#ef4444' : c.load >= 65 ? '#f59e0b' : '#6366f1'}
                            strokeWidth="3" strokeLinecap="round" strokeDasharray="94.25"
                            animate={{ strokeDashoffset: 94.25 - (c.load/100)*94.25 }} transition={{ duration: 0.6 }}/>
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                          {Math.round(c.load)}%
                        </span>
                      </div>
                      <p className="text-[9px] text-gray-600">C{c.core}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'storage' && (
          <div className="space-y-4">
            {(metrics.storage || []).map((disk: any, i: number) => (
              <div key={i} className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <HardDrive size={18} className="text-emerald-400"/>
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
                  <motion.div className={`h-full rounded-full ${disk.usagePercent >= 85 ? 'bg-red-500' : disk.usagePercent >= 65 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                    animate={{ width: `${disk.usagePercent}%` }} transition={{ duration: 1 }}/>
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

        {activeTab === 'processes' && (
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
              <span className="text-sm font-medium text-white">PM2 Processes</span>
              <span className="text-xs text-gray-500">{(metrics.pm2Apps||[]).length} proses</span>
            </div>
            {(metrics.pm2Apps||[]).length === 0 ? (
              <div className="py-12 text-center text-gray-600 text-sm">Tidak ada PM2 process.</div>
            ) : (
              <div className="divide-y divide-white/5">
                <div className="grid grid-cols-7 px-5 py-2 text-xs text-gray-600 uppercase tracking-wider">
                  <span className="col-span-2">Name</span><span>PID</span><span>Status</span>
                  <span>CPU</span><span>Mem</span><span>Restart</span>
                </div>
                {metrics.pm2Apps.map((app: any, i: number) => (
                  <div key={i} className="grid grid-cols-7 px-5 py-3 text-sm hover:bg-white/[0.02]">
                    <span className="col-span-2 text-white font-mono truncate">{app.name}</span>
                    <span className="text-gray-500 font-mono">{app.pid}</span>
                    <span className={app.status==='online' ? 'text-green-400' : 'text-red-400'}>{app.status}</span>
                    <span className={app.cpu > 50 ? 'text-yellow-400' : 'text-gray-400'}>{app.cpu.toFixed(1)}%</span>
                    <span className="text-gray-400">{app.memMB}MB</span>
                    <span className="text-gray-600">{app.restarts}x</span>
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
