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
const { gatherMetrics } = require('./routes/monitoring');

const app    = express();
const server = http.createServer(app);

// ─── WebSocket Server ─────────────────────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' });

// Inject wss ke deployer agar bisa emit logs
deployer.setWss(wss);

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

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SERVER] Shutting down gracefully...');
  server.close(() => {
    db.close();
    process.exit(0);
  });
});

module.exports = { app, server, wss };
