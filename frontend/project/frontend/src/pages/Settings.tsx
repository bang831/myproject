// src/pages/Settings.tsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon, Key, Save, CheckCircle2,
  Loader2, AlertTriangle, Eye, EyeOff, Globe, Link,
  Info, RefreshCw,
} from 'lucide-react';
import { cloudflare } from '../lib/api';

export default function Settings() {
  const [cfToken, setCfToken]     = useState('');
  const [tunnelId, setTunnelId]   = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [hasTunnel, setHasTunnel]   = useState(false);
  const [status, setStatus]         = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [zones, setZones]           = useState<any[]>([]);
  const [zonesLoading, setZonesLoading] = useState(false);

  useEffect(() => {
    cloudflare.settings()
      .then(data => {
        setConfigured(data.configured);
        setHasTunnel(data.hasTunnel);
      })
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const payload: any = {};
      if (cfToken.trim())   payload.cf_token     = cfToken.trim();
      if (tunnelId.trim())  payload.cf_tunnel_id  = tunnelId.trim();

      await cloudflare.saveSettings(payload);
      setStatus({ type: 'success', msg: 'Settings berhasil disimpan!' });
      setConfigured(!!cfToken || configured);
      setHasTunnel(!!tunnelId || hasTunnel);
      setCfToken('');
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message || 'Gagal menyimpan.' });
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setStatus(null);
    try {
      const { valid } = await cloudflare.verify();
      setStatus({
        type: valid ? 'success' : 'error',
        msg:  valid ? '✅ Token Cloudflare valid!' : '❌ Token tidak valid atau expired.',
      });
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setVerifying(false);
    }
  };

  const handleLoadZones = async () => {
    setZonesLoading(true);
    try {
      const data = await cloudflare.zones();
      setZones(data);
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setZonesLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] pb-12">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#0A0E1A]/80 border-b border-white/5 px-8 py-4">
        <div className="flex items-center gap-3">
          <SettingsIcon size={20} className="text-indigo-400" />
          <h1 className="text-xl font-bold text-white">Settings</h1>
        </div>
      </div>

      <div className="px-8 py-8 max-w-2xl space-y-6">

        {/* Status bar */}
        {status && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${
              status.type === 'success'
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            {status.type === 'success' ? <CheckCircle2 size={16} className="mt-0.5" /> : <AlertTriangle size={16} className="mt-0.5" />}
            {status.msg}
          </motion.div>
        )}

        {/* CF Status */}
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe size={20} className="text-indigo-400" />
              <div>
                <p className="text-sm font-medium text-white">Cloudflare API</p>
                <p className="text-xs text-gray-500">Dibutuhkan untuk auto-DNS dan SSL</p>
              </div>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
              configured
                ? 'text-green-400 bg-green-400/10 border-green-400/20'
                : 'text-gray-500 bg-gray-500/10 border-gray-500/20'
            }`}>
              {configured ? <><CheckCircle2 size={12} /> Terkonfigurasi</> : 'Belum dikonfigurasi'}
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-5">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Key size={15} className="text-indigo-400" />
            Cloudflare Credentials
          </h2>

          {/* CF Token */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              API Token
              <span className="ml-2 text-gray-600">
                (buat di <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Cloudflare Dashboard</a>)
              </span>
            </label>
            <div className="relative">
              <Key size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
              <input
                type={showToken ? 'text' : 'password'}
                value={cfToken}
                onChange={e => setCfToken(e.target.value)}
                placeholder={configured ? '••••••• (kosongkan jika tidak ingin mengubah)' : 'cf_token_...'}
                className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 text-sm font-mono transition-all"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
              >
                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-1.5 flex items-start gap-1.5">
              <Info size={11} className="mt-0.5 shrink-0" />
              Permission: Zone:Read, DNS:Edit
            </p>
          </div>

          {/* Tunnel ID */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Cloudflare Tunnel ID
              <span className="ml-2 text-gray-600">(dari <code className="text-xs bg-white/5 px-1 rounded">cloudflared tunnel list</code>)</span>
            </label>
            <div className="relative">
              <Link size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
              <input
                type="text"
                value={tunnelId}
                onChange={e => setTunnelId(e.target.value)}
                placeholder={hasTunnel ? '(sudah tersimpan)' : 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 text-sm font-mono transition-all"
              />
            </div>
            <p className="text-xs text-gray-600 mt-1.5">
              DNS record akan mengarah ke <code className="bg-white/5 px-1 rounded">{'{tunnel-id}'}.cfargotunnel.com</code>
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-sm font-semibold text-white hover:opacity-90 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Simpan
            </button>
            <button
              type="button"
              onClick={handleVerify}
              disabled={verifying || !configured}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-400 hover:bg-white/10 transition-all disabled:opacity-40"
            >
              {verifying ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Verify Token
            </button>
          </div>
        </form>

        {/* List Zones/Domains */}
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Globe size={15} className="text-indigo-400" />
              Domains di Akun Cloudflare
            </h2>
            <button
              onClick={handleLoadZones}
              disabled={zonesLoading || !configured}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-xs text-gray-400 hover:bg-white/10 transition-all disabled:opacity-40"
            >
              {zonesLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Load
            </button>
          </div>

          {zones.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-4">
              {configured ? 'Klik Load untuk melihat domains.' : 'Konfigurasi API Token dulu.'}
            </p>
          ) : (
            <div className="space-y-2">
              {zones.map(z => (
                <div key={z.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <Globe size={14} className="text-indigo-400" />
                    <span className="text-sm text-white font-mono">{z.name}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    z.status === 'active'
                      ? 'text-green-400 bg-green-400/10'
                      : 'text-gray-500 bg-gray-500/10'
                  }`}>
                    {z.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Setup Guide */}
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Info size={14} className="text-indigo-400" />
            Setup Guide (Android/Termux)
          </h3>
          <div className="space-y-2 text-xs text-gray-500 font-mono">
            {[
              '# 1. Install cloudflared di Termux/Ubuntu proot',
              'curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o cloudflared',
              'chmod +x cloudflared && mv cloudflared /usr/local/bin/',
              '',
              '# 2. Login ke Cloudflare',
              'cloudflared tunnel login',
              '',
              '# 3. Buat tunnel',
              'cloudflared tunnel create deployflow-tunnel',
              '',
              '# 4. Catat Tunnel ID dari output di atas, paste ke Settings',
            ].map((line, i) => (
              <div key={i} className={line.startsWith('#') ? 'text-indigo-400/70' : line === '' ? 'my-1' : ''}>
                {line || '\u00a0'}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
