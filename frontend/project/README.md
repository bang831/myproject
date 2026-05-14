# 🚀 DeployFlow — Mini Railway/Vercel di Android

Self-hosted deploy panel yang jalan di HP Android via Termux + Ubuntu proot.

## Stack

```
Android
└── Termux
    └── Ubuntu proot
        ├── Nginx          ← reverse proxy
        ├── Node.js
        │   ├── PM2        ← process manager
        │   └── SQLite     ← database
        ├── DeployFlow Panel (backend + frontend)
        └── cloudflared    ← Cloudflare Tunnel
```

## Struktur Folder

```
/root/
├── apps/               ← project user yang di-deploy
│   ├── app-1234/
│   └── app-5678/
├── panel/
│   ├── backend/        ← Express + SQLite + WebSocket
│   │   ├── server.js
│   │   ├── db.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── projects.js
│   │   │   ├── deployments.js
│   │   │   ├── monitoring.js
│   │   │   └── cloudflare.js
│   │   └── lib/
│   │       ├── deployer.js   ← core deploy engine
│   │       ├── nginx.js      ← nginx config manager
│   │       └── cloudflare.js ← CF API integration
│   └── frontend/       ← Vite + React + TypeScript
│       └── src/
│           ├── lib/api.ts     ← REST + WebSocket client
│           └── pages/
├── logs/
└── database/           ← panel.db (SQLite)
```

## Quick Start

### 1. Install di Termux (Android)

```bash
# Install Termux dari F-Droid (bukan Play Store)
# Install Ubuntu proot
pkg install proot-distro
proot-distro install ubuntu
proot-distro login ubuntu

# Dalam Ubuntu
cd /root
git clone <repo-ini> panel
bash panel/setup.sh
```

### 2. Manual Setup

```bash
# Backend
cd /root/panel/backend
cp .env.example .env
# Edit .env - isi JWT_SECRET minimal
nano .env

npm install
node server.js
# Panel tersedia di http://localhost:4000
```

```bash
# Frontend (development)
cd /root/panel/frontend
npm install
npm run dev
# Dev server di http://localhost:5173
# Proxy ke backend otomatis via vite.config.ts
```

```bash
# Frontend (production - serve via backend)
cd /root/panel/frontend
npm run build
# File di dist/ otomatis diserve oleh backend di port 4000
```

### 3. Akses dari HP / Luar Jaringan

Karena jalan di HP, pakai **Cloudflare Tunnel** supaya bisa diakses dari mana saja:

```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# Login ke Cloudflare
cloudflared tunnel login

# Buat tunnel
cloudflared tunnel create deployflow-tunnel

# Jalankan tunnel (expose port 4000 ke internet)
cloudflared tunnel run --url http://localhost:4000 deployflow-tunnel
```

Setelah itu:
1. Buka panel → Settings
2. Isi **API Token** Cloudflare (permission: Zone:Read, DNS:Edit)
3. Isi **Tunnel ID** dari `cloudflared tunnel list`
4. Klik Verify Token

### 4. Auto-restart setelah HP reboot

Install **Termux:Boot** dari F-Droid, lalu:

```bash
mkdir -p ~/.termux/boot
cat > ~/.termux/boot/start.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
proot-distro login ubuntu -- bash /root/start-deployflow.sh
EOF
chmod +x ~/.termux/boot/start.sh
```

---

## Flow Deploy

```
User klik "Deploy Baru"
    ↓
Pilih source: GitHub URL atau Upload ZIP
    ↓
Pilih domain dari Cloudflare
    ↓
Backend:
    1. Generate app-ID (app-XXXX)
    2. Extract ZIP / git clone
    3. Detect type: nextjs/vite/node/static
    4. Assign port (3100-3999)
    5. npm install
    6. npm run build (jika vite/next)
    7. pm2 start (jika node/next)
    8. Generate Nginx config
    9. nginx -t && nginx reload
    10. Cloudflare API: create DNS CNAME
    ↓
WebSocket stream log ke frontend (real-time)
    ↓
Website online! 🎉
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login → JWT |
| POST | `/api/auth/register` | Register (pertama kali saja) |
| GET | `/api/auth/me` | Verify token |
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create + deploy (form-data: zip atau repo_url) |
| POST | `/api/projects/:id/redeploy` | Redeploy |
| GET | `/api/projects/:id/logs` | PM2 logs |
| DELETE | `/api/projects/:id` | Delete project |
| GET | `/api/deployments?projectId=X` | Deployment history |
| GET | `/api/monitoring` | System metrics |
| GET | `/api/cloudflare/zones` | List CF domains |
| POST | `/api/cloudflare/settings` | Simpan CF token |
| GET | `/api/health` | Health check |

## WebSocket Events

Connect ke `ws://localhost:4000/ws`

```json
// Subscribe ke deploy log
{ "type": "subscribe", "channel": "deploy:app-1234" }

// Subscribe ke metrics realtime
{ "type": "subscribe", "channel": "metrics" }
```

Events yang diterima:
- `deploy_log` → log baris per baris saat deploy
- `deploy_status` → status berubah (building/ready/error)
- `metrics` → sistem metrics setiap 3 detik (CPU, RAM, dll)

---

## Environment Variables (backend/.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Port backend |
| `JWT_SECRET` | _(wajib diisi)_ | Secret untuk JWT |
| `APPS_DIR` | `~/apps` | Folder project yang di-deploy |
| `NGINX_DIR` | `/etc/nginx/sites-enabled` | Folder nginx config |
| `STATIC_ROOT` | `/var/www` | Folder static files |
| `PORT_START` | `3100` | Port awal untuk apps |
| `PORT_END` | `3999` | Port akhir untuk apps |
| `CORS_ORIGIN` | `*` | CORS origin |

---

**android yang awalnya cuma dipake buat scroll reels sambil rebahan... sekarang jadi server prod 😭**
