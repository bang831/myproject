import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCheck, Trash2, X, AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import { wsClient } from '../lib/api';

const token = () => localStorage.getItem('deployflow_token');

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  project_name?: string;
  app_id?: string;
  read: number;
  created_at: string;
}

export default function NotificationBell() {
  const [notifs, setNotifs]       = useState<Notification[]>([]);
  const [unread, setUnread]       = useState(0);
  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchUnread = async () => {
    try {
      const res = await fetch('/api/notifications/unread', { headers: { Authorization: `Bearer ${token()}` } });
      const d = await res.json();
      setUnread(d.count || 0);
    } catch {}
  };

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${token()}` } });
      const d = await res.json();
      setNotifs(Array.isArray(d) ? d : []);
    } catch {}
    finally { setLoading(false); }
  };

  const markAllRead = async () => {
    await fetch('/api/notifications/read-all', { method: 'PUT', headers: { Authorization: `Bearer ${token()}` } });
    setUnread(0);
    setNotifs(prev => prev.map(n => ({ ...n, read: 1 })));
  };

  const clearAll = async () => {
    await fetch('/api/notifications', { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    setNotifs([]);
    setUnread(0);
  };

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);

    // Listen WS untuk notif baru
    const unsub = wsClient.on('notification', (data) => {
      setUnread(prev => prev + 1);
      setNotifs(prev => [{
        id: Date.now(), type: data.data.type, title: data.data.title,
        message: data.data.message, read: 0, created_at: new Date().toISOString(),
      }, ...prev]);
    });

    // Close on outside click
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);

    return () => { clearInterval(interval); unsub(); document.removeEventListener('mousedown', handleClick); };
  }, []);

  const handleOpen = () => {
    setOpen(!open);
    if (!open) fetchNotifs();
  };

  const iconFor = (type: string) => ({
    success: <CheckCircle size={14} className="text-green-400 shrink-0"/>,
    error:   <XCircle    size={14} className="text-red-400 shrink-0"/>,
    warning: <AlertTriangle size={14} className="text-yellow-400 shrink-0"/>,
  }[type] || <Info size={14} className="text-blue-400 shrink-0"/>);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'baru saja';
    if (m < 60) return `${m}m lalu`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}j lalu`;
    return `${Math.floor(h/24)}h lalu`;
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={handleOpen}
        className="relative p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-colors">
        <Bell size={18}/>
        {unread > 0 && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity:0, y:8, scale:0.95 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:8, scale:0.95 }}
            className="absolute right-0 top-full mt-2 w-80 rounded-2xl bg-[#0F1117] border border-white/10 shadow-2xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <span className="text-sm font-semibold text-white">Notifikasi</span>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button onClick={markAllRead} title="Tandai semua dibaca"
                    className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-green-400 transition-colors">
                    <CheckCheck size={14}/>
                  </button>
                )}
                <button onClick={clearAll} title="Hapus semua"
                  className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-red-400 transition-colors">
                  <Trash2 size={14}/>
                </button>
                <button onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-colors">
                  <X size={14}/>
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="py-8 text-center text-sm text-gray-600">Loading...</div>
              ) : notifs.length === 0 ? (
                <div className="py-8 text-center">
                  <Bell size={24} className="text-gray-700 mx-auto mb-2"/>
                  <p className="text-sm text-gray-600">Tidak ada notifikasi</p>
                </div>
              ) : (
                notifs.map(n => (
                  <div key={n.id} className={`px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors ${!n.read ? 'bg-indigo-500/5' : ''}`}>
                    <div className="flex items-start gap-2.5">
                      {iconFor(n.type)}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium ${!n.read ? 'text-white' : 'text-gray-400'}`}>{n.title}</p>
                        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{n.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {n.project_name && <span className="text-xs text-indigo-400">{n.project_name}</span>}
                          <span className="text-xs text-gray-700">{timeAgo(n.created_at)}</span>
                        </div>
                      </div>
                      {!n.read && <div className="w-2 h-2 rounded-full bg-indigo-400 shrink-0 mt-1"/>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
