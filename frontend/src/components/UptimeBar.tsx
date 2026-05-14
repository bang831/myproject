import { useState, useEffect } from 'react';
import { Activity, TrendingUp } from 'lucide-react';

const token = () => localStorage.getItem('deployflow_token');

export default function UptimeBar({ projectId }: { projectId: string }) {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/notifications/uptime/${projectId}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(setStats).catch(() => {});
  }, [projectId]);

  if (!stats || stats.stats24h?.total === 0) {
    return (
      <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
        <div className="flex items-center gap-2 mb-3">
          <Activity size={15} className="text-indigo-400"/>
          <span className="text-sm font-medium text-white">Uptime Monitor</span>
        </div>
        <p className="text-xs text-gray-600">Belum ada data uptime. Health check berjalan setiap 2 menit.</p>
      </div>
    );
  }

  const { stats7d, stats30d, stats24h, hourly } = stats;

  const uptimeColor = (pct: number) =>
    pct >= 99 ? 'text-green-400' : pct >= 95 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4">
      <div className="flex items-center gap-2">
        <Activity size={15} className="text-indigo-400"/>
        <span className="text-sm font-medium text-white">Uptime Monitor</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '24 Jam', stats: stats24h },
          { label: '7 Hari', stats: stats7d },
          { label: '30 Hari', stats: stats30d },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-center">
            <p className={`text-lg font-bold ${s.stats?.uptime != null ? uptimeColor(s.stats.uptime) : 'text-gray-600'}`}>
              {s.stats?.uptime != null ? `${s.stats.uptime}%` : 'N/A'}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Hourly bar */}
      {hourly && hourly.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Status 24 jam terakhir</p>
          <div className="flex gap-0.5 items-end h-8">
            {hourly.map((h: any, i: number) => {
              const pct = h.total > 0 ? (h.up / h.total) * 100 : 0;
              return (
                <div key={i} title={`${h.hour} — ${pct.toFixed(0)}% uptime`}
                  className={`flex-1 rounded-sm ${pct >= 99 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ height: `${Math.max(20, pct)}%`, opacity: 0.7 + pct/100*0.3 }}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-gray-700 mt-1">
            <span>24j lalu</span>
            <span>Sekarang</span>
          </div>
        </div>
      )}
    </div>
  );
}
