// server.js - DeployFlow Backend Server
// Mini Railway / Mini Vercel di Android
require('dotenv').config();

const express  = require('express');
const http     = require('http');
const cors     = require('cors');
const path     = require('path');
const { WebSocketServer } = require('ws');
const rateLimit = require('express-rate-limit');

const { db } = require('./db');
const deployer = require('./lib/deployer');
const healthcheck = require('./lib/healthcheck');
const { gatherMetrics } = require('./routes/monitoring');

const app    = express();
const server = http.createServer(app);

// ─── WebSocket Server ─────────────────────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' });

// Inject wss ke deployer agar bisa emit logs
deployer.setWss(wss);
healthcheck.setWss(wss);

wss.on('connection', (ws, req) => {
  ws._subscriptions = new Set();

  console.log(`[WS] Client connected from ${req.socket.remoteAddress}`);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'subscribe') {
        ws._subscriptions.add(msg.channel);
        ws.send(JSON.stringify({ type: 'subscribed', channel: msg.channel }));
        console.log(`[WS] Subscribed to: ${msg.channel}`);
      }

      if (msg.type === 'unsubscribe') {
        ws._subscriptions.delete(msg.channel);
      }

      // Ping/pong keepalive
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
      }
    } catch {}
  });

  ws.on('close', () => {
    console.log('[WS] Client disconnected');
  });

  ws.on('error', (err) => {
    if (err.code !== 'ECONNRESET') console.error('[WS Error]', err.message);
  });

  // Kirim initial ping
  ws.send(JSON.stringify({ type: 'connected', ts: Date.now() }));
});

// ─── Push real-time monitoring metrics setiap 3 detik ─────────────────────
setInterval(async () => {
  const monitoringClients = [...wss.clients].filter(
    c => c.readyState === 1 && c._subscriptions?.has('metrics')
  );

  if (monitoringClients.length === 0) return;

  try {
    const metrics = await gatherMetrics();
    const msg = JSON.stringify({ type: 'metrics', data: metrics });
    monitoringClients.forEach(c => c.send(msg));
  } catch {}
}, 3000);

// ─── Middleware ───────────────────────────────────────────────────────────
app.set('trust proxy', 1);
app.set('trust proxy', 1);
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' },
  skip: (req) => req.path.startsWith('/ws'),
});
app.use(limiter);

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/projects',    require('./routes/projects'));
app.use('/api/deployments', require('./routes/deployments'));
app.use('/api/monitoring',  require('./routes/monitoring').router);
app.use('/api/cloudflare',  require('./routes/cloudflare'));
app.use('/api/files',       require('./routes/files'));
app.use('/api/ai',          require('./routes/ai'));
app.use('/api/notifications', require('./routes/notifications'));

// Health check
app.get('/api/health', (_req, res) => {
  const projects = db.prepare('SELECT COUNT(*) as c FROM projects').get().c;
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    projects,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── Serve Frontend (production) ──────────────────────────────────────────
const distPath = path.join(__dirname, '../frontend/dist');
const fs = require('fs');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// ─── Error Handler ────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[SERVER ERROR]', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File terlalu besar. Maksimum 200MB.' });
  }
  res.status(500).json({ error: err.message || 'Internal server error.' });
});

// ─── Start ────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '4000');
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════╗
║   🚀 DeployFlow Backend                      ║
║   Port  : ${PORT}                               ║
║   API   : http://localhost:${PORT}/api          ║
║   WS    : ws://localhost:${PORT}/ws             ║
║   Mode  : ${process.env.NODE_ENV || 'development'}                        ║
╚══════════════════════════════════════════════╝
  `);
});


// ─── Cron: Hapus DNS yang sudah 10 hari ──────────────────────────────────
const cron = require('node-cron');
cron.schedule('0 0 * * *', async () => {
  const fs = require('fs');
  const schedPath = './database/pending_dns_delete.json';
  if (!fs.existsSync(schedPath)) return;

  try {
    let pending = JSON.parse(fs.readFileSync(schedPath, 'utf8'));
    const now = Date.now();
    const remaining = [];

    for (const item of pending) {
      if (now >= item.delete_at) {
        console.log(`[CRON] Menghapus DNS ${item.domain} (sudah 10 hari)...`);
        try {
          // Hapus DNS Cloudflare
          if (item.cf_record_id) {
            const cf = require('./lib/cloudflare');
            const zones = await cf.getZones().catch(() => []);
            const domainParts = item.domain.split('.');
            const rootDomain = domainParts.slice(-2).join('.');
            const zone = zones.find(z => z.name === rootDomain);
            if (zone) {
              await cf.deleteDnsRecord(zone.id, item.cf_record_id);
              console.log(`[CRON] DNS ${item.domain} berhasil dihapus`);
            }
          }
          // Hapus nginx deleted config
          const nginx = require('./lib/nginx');
          nginx.removeConfig(item.nginx_deleted_config);
          await nginx.reloadNginx().catch(() => {});
          console.log(`[CRON] Nginx config ${item.nginx_deleted_config} dihapus`);
        } catch (e) {
          console.log(`[CRON] Error hapus ${item.domain}: ${e.message}`);
          remaining.push(item); // Coba lagi besok
        }
      } else {
        const sisaHari = Math.ceil((item.delete_at - now) / (24*60*60*1000));
        console.log(`[CRON] ${item.domain} akan dihapus dalam ${sisaHari} hari lagi`);
        remaining.push(item);
      }
    }

    fs.writeFileSync(schedPath, JSON.stringify(remaining, null, 2));
  } catch (e) {
    console.error('[CRON] Error:', e.message);
  }
});
console.log('[CRON] DNS cleanup scheduler aktif (cek setiap tengah malam)');


// ─── Health Check setiap 2 menit ─────────────────────────────────────────
setInterval(async () => {
  try { await healthcheck.runHealthCheck(); }
  catch (err) { console.error('[HEALTH]', err.message); }
}, 2 * 60 * 1000);
console.log('[HEALTH] Health check aktif (interval: 2 menit)');

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SERVER] Shutting down gracefully...');
  server.close(() => {
    db.close();
    process.exit(0);
  });
});

module.exports = { app, server, wss };
