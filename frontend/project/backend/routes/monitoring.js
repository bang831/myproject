// routes/monitoring.js - Real System Metrics
const express = require('express');
const si      = require('systeminformation');
const { exec } = require('child_process');
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// Cache metrics untuk hindari overload
let metricsCache   = null;
let cacheTimestamp = 0;
const CACHE_TTL    = 2000; // 2 detik

async function gatherMetrics() {
  const now = Date.now();
  if (metricsCache && now - cacheTimestamp < CACHE_TTL) {
    return metricsCache;
  }

  try {
    const [cpu, cpuLoad, mem, fsSize, networkStats, osInfo, time] = await Promise.all([
      si.cpu(),
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
      si.osInfo(),
      si.time(),
    ]);

    // Top processes via pm2 list
    const pm2List = await getPm2Apps();

    // Network
    const netIf = networkStats[0] || {};

    const metrics = {
      timestamp: new Date().toISOString(),
      uptime:    formatUptime(time.uptime),
      hostname:  osInfo.hostname,
      platform:  `${osInfo.distro} ${osInfo.release}`,
      arch:      osInfo.arch,

      cpu: {
        usagePercent: parseFloat(cpuLoad.currentLoad.toFixed(1)),
        cores:        cpu.cores,
        model:        cpu.brand || cpu.manufacturer,
        speed:        cpu.speed,
        loadAverage:  [
          parseFloat((cpuLoad.avgLoad || 0).toFixed(2)),
          parseFloat((cpuLoad.currentLoad / 100 * cpu.cores).toFixed(2)),
          0,
        ],
        perCore: cpuLoad.cpus?.slice(0, 8).map((c, i) => ({
          core:  i,
          load:  parseFloat(c.load.toFixed(1)),
        })) || [],
      },

      memory: {
        totalMB:  Math.round(mem.total / 1024 / 1024),
        usedMB:   Math.round(mem.used  / 1024 / 1024),
        freeMB:   Math.round(mem.free  / 1024 / 1024),
        cachedMB: Math.round((mem.cached || 0) / 1024 / 1024),
        swapTotalMB: Math.round((mem.swaptotal || 0) / 1024 / 1024),
        swapUsedMB:  Math.round((mem.swapused  || 0) / 1024 / 1024),
        usagePercent: parseFloat(((mem.used / mem.total) * 100).toFixed(1)),
      },

      storage: fsSize
        .filter(fs => fs.size > 0)
        .map(fs => ({
          device:      fs.fs,
          mount:       fs.mount,
          filesystem:  fs.type,
          totalGB:     parseFloat((fs.size  / 1e9).toFixed(1)),
          usedGB:      parseFloat((fs.used  / 1e9).toFixed(1)),
          freeGB:      parseFloat(((fs.size - fs.used) / 1e9).toFixed(1)),
          usagePercent: parseFloat(fs.use.toFixed(1)),
        })),

      network: {
        iface:       netIf.iface || 'eth0',
        rxMBs:       parseFloat(((netIf.rx_sec || 0) / 1024 / 1024).toFixed(3)),
        txMBs:       parseFloat(((netIf.tx_sec || 0) / 1024 / 1024).toFixed(3)),
        rxTotal:     formatBytes(netIf.rx_bytes || 0),
        txTotal:     formatBytes(netIf.tx_bytes || 0),
      },

      pm2Apps: pm2List,

      summary: {
        totalProjects:  db.prepare('SELECT COUNT(*) as c FROM projects').get().c,
        runningProjects: db.prepare("SELECT COUNT(*) as c FROM projects WHERE status = 'ready'").get().c,
        errorProjects:  db.prepare("SELECT COUNT(*) as c FROM projects WHERE status = 'error'").get().c,
        totalDeployments: db.prepare('SELECT COUNT(*) as c FROM deployments').get().c,
      },
    };

    metricsCache   = metrics;
    cacheTimestamp = now;
    return metrics;

  } catch (err) {
    console.error('[MONITORING]', err.message);
    throw err;
  }
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}

function formatBytes(bytes) {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function getPm2Apps() {
  return new Promise((resolve) => {
    exec('pm2 jlist 2>/dev/null', (err, stdout) => {
      if (err || !stdout.trim()) return resolve([]);
      try {
        const list = JSON.parse(stdout);
        resolve(list.map(p => ({
          name:   p.name,
          pid:    p.pid,
          status: p.pm2_env?.status || 'unknown',
          cpu:    p.monit?.cpu    || 0,
          memMB:  Math.round((p.monit?.memory || 0) / 1024 / 1024),
          uptime: p.pm2_env?.pm_uptime ? formatUptime((Date.now() - p.pm2_env.pm_uptime) / 1000) : '-',
          restarts: p.pm2_env?.restart_time || 0,
        })));
      } catch {
        resolve([]);
      }
    });
  });
}

// GET /api/monitoring
router.get('/', async (req, res) => {
  try {
    const metrics = await gatherMetrics();
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: 'Gagal ambil metrics sistem.' });
  }
});

module.exports = { router, gatherMetrics };
