// src/lib/api.ts
// API Client - menggantikan Supabase sepenuhnya
// Semua komunikasi dengan backend via REST + WebSocket

const API_BASE = import.meta.env.VITE_API_URL || '';

// ─── Storage token ───────────────────────────────────────────────────────
const TOKEN_KEY = 'deployflow_token';
const USER_KEY  = 'deployflow_user';

export const storage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),
  getUser: (): any => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
  },
  setUser: (u: any) => localStorage.setItem(USER_KEY, JSON.stringify(u)),
  clearUser: () => localStorage.removeItem(USER_KEY),
  clear: () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); },
};

// ─── HTTP Client ─────────────────────────────────────────────────────────
async function request<T = any>(
  method: string,
  endpoint: string,
  body?: any,
  options: { formData?: FormData } = {}
): Promise<T> {
  const token = storage.getToken();
  const headers: Record<string, string> = {};

  if (token) headers['Authorization'] = `Bearer ${token}`;

  let fetchOptions: RequestInit = { method, headers };

  if (options.formData) {
    fetchOptions.body = options.formData;
    // Tidak set Content-Type agar browser set boundary otomatis
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, fetchOptions);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── Auth ─────────────────────────────────────────────────────────────────
export const auth = {
  async login(email: string, password: string) {
    const data = await request('POST', '/api/auth/login', { email, password });
    storage.setToken(data.token);
    storage.setUser(data.user);
    return data;
  },

  async register(email: string, password: string) {
    const data = await request('POST', '/api/auth/register', { email, password });
    storage.setToken(data.token);
    storage.setUser(data.user);
    return data;
  },

  async me() {
    return request('GET', '/api/auth/me');
  },

  async logout() {
    await request('POST', '/api/auth/logout').catch(() => {});
    storage.clear();
  },

  isLoggedIn() {
    return !!storage.getToken();
  },

  getCurrentUser() {
    return storage.getUser();
  },
};

// ─── Projects ─────────────────────────────────────────────────────────────
export const projects = {
  list() {
    return request('GET', '/api/projects');
  },

  get(id: number | string) {
    return request('GET', `/api/projects/${id}`);
  },

  // Create dari GitHub URL
  createFromRepo(data: {
    name: string;
    repo_url: string;
    branch?: string;
    framework?: string;
    cf_zone_id?: string;
    cf_domain: string;
    cf_subdomain?: string;
    env_vars?: Record<string, string>;
  }) {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined) fd.append(k, typeof v === 'object' ? JSON.stringify(v) : v);
    });
    return request('POST', '/api/projects', undefined, { formData: fd });
  },

  // Create dari ZIP upload
  createFromZip(data: {
    name: string;
    framework?: string;
    cf_zone_id?: string;
    cf_domain: string;
    cf_subdomain?: string;
    env_vars?: Record<string, string>;
    zip: File;
  }) {
    const fd = new FormData();
    const { zip, ...rest } = data;
    Object.entries(rest).forEach(([k, v]) => {
      if (v !== undefined) fd.append(k, typeof v === 'object' ? JSON.stringify(v) : v);
    });
    fd.append('zip', zip);
    return request('POST', '/api/projects', undefined, { formData: fd });
  },

  redeploy(id: number | string) {
    return request('POST', `/api/projects/${id}/redeploy`);
  },

  update(id: number | string, data: { env_vars?: any; branch?: string }) {
    return request('PUT', `/api/projects/${id}`, data);
  },

  delete(id: number | string) {
    return request('DELETE', `/api/projects/${id}`);
  },

  logs(id: number | string, lines = 200) {
    return request('GET', `/api/projects/${id}/logs?lines=${lines}`);
  },
};

// ─── Deployments ──────────────────────────────────────────────────────────
export const deployments = {
  list(projectId?: number | string) {
    const qs = projectId ? `?projectId=${projectId}` : '';
    return request('GET', `/api/deployments${qs}`);
  },

  get(id: number | string) {
    return request('GET', `/api/deployments/${id}`);
  },
};

// ─── Monitoring ───────────────────────────────────────────────────────────
export const monitoring = {
  get() {
    return request('GET', '/api/monitoring');
  },
};

// ─── Cloudflare ───────────────────────────────────────────────────────────
export const cloudflare = {
  zones() {
    return request('GET', '/api/cloudflare/zones');
  },

  dns(zoneId: string) {
    return request('GET', `/api/cloudflare/dns?zoneId=${zoneId}`);
  },

  settings() {
    return request('GET', '/api/cloudflare/settings');
  },

  saveSettings(data: { cf_token?: string; cf_tunnel_id?: string }) {
    return request('POST', '/api/cloudflare/settings', data);
  },

  verify() {
    return request('POST', '/api/cloudflare/verify');
  },
};

// ─── WebSocket Client ─────────────────────────────────────────────────────
const WS_URL = import.meta.env.VITE_WS_URL ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
    : 'ws://localhost:4000/ws');

type WsListener = (data: any) => void;

class DeployFlowWS {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<WsListener>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 2000;
  private subscriptions: Set<string> = new Set();
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('[WS] Connected');
        this.reconnectDelay = 2000;
        // Re-subscribe semua channel setelah reconnect
        this.subscriptions.forEach(ch => this.sendRaw({ type: 'subscribe', channel: ch }));
        // Ping setiap 30 detik
        this.pingTimer = setInterval(() => this.sendRaw({ type: 'ping' }), 30000);
        this.emit('_connected', {});
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.emit(msg.type, msg);

          // Route deploy logs ke channel deploy:appId
          if (msg.type === 'deploy_log' && msg.appId) {
            this.emit(`deploy:${msg.appId}`, msg);
          }
          if (msg.type === 'deploy_status' && msg.appId) {
            this.emit(`status:${msg.appId}`, msg);
          }
          if (msg.type === 'metrics') {
            this.emit('metrics', msg.data);
          }
        } catch {}
      };

      this.ws.onclose = () => {
        console.log('[WS] Disconnected, reconnecting...');
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.emit('_disconnected', {});
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // Handled by onclose
      };

    } catch (err) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000);
      this.connect();
    }, this.reconnectDelay);
  }

  private sendRaw(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  subscribe(channel: string) {
    this.subscriptions.add(channel);
    this.sendRaw({ type: 'subscribe', channel });
  }

  unsubscribe(channel: string) {
    this.subscriptions.delete(channel);
    this.sendRaw({ type: 'unsubscribe', channel });
  }

  on(event: string, listener: WsListener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return () => this.off(event, listener);
  }

  off(event: string, listener: WsListener) {
    this.listeners.get(event)?.delete(listener);
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(fn => fn(data));
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.ws?.close();
    this.ws = null;
  }
}

// Singleton WS instance
export const wsClient = new DeployFlowWS();
