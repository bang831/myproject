const express = require('express');
const si      = require('systeminformation');
const { exec } = require('child_process');
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

let metricsCache   = null;
let cacheTimestamp = 0;
const CACHE_TTL    = 2000;

let speedCache = null;
let speedTimestamp = 0;

async function getInternetSpeed() {
  const now = Date.now();
  if (speedCache && now - speedTimestamp < 5 * 60 * 1000) return speedCache;
  return new Promise(resolve => {
    exec('curl -o /dev/null -s -w "%{speed_download}" https://speed.cloudflare.com/__down?bytes=1000000 2>/dev/null',
      { timeout: 15000 }, (err, stdout) => {
      if (err) return resolve({ downloadMBs: 0 });
      const bytesPerSec = parseFloat(stdout) || 0;
      const downloadMBs = parseFloat((bytesPerSec / 1024 / 1024).toFixed(2));
      speedCache = { downloadMBs, testedAt: new Date().toISOString() };
      speedTimestamp = now;
      resolve(speedCache);
    });
  });
}

async function getDiskIO() {
  try {
    const io = await si.disksIO();
    return {
      readMBs:  parseFloat(((io.rIO_sec || 0) / 1024 / 1024).toFixed(3)),
      writeMBs: parseFloat(((io.wIO_sec || 0) / 1024 / 1024).toFixed(3)),
      readOps:  Math.round(io.rIO_sec || 0),
      writeOps: Math.round(io.wIO_sec || 0),
    };
  } catch {
    return { readMBs: 0, writeMBs: 0, readOps: 0, writeOps: 0 };
  }
}

function getConnections() {
  return new Promise(resolve => {
    exec('ss -s 2>/dev/null', (err, stdout) => {
      if (err) return resolve({ established: 0 });
      const m = stdout.match(/estab\s+(\d+)/);
      resolve({ established: m ? parseInt(m[1]) : 0 });
    });
  });
}

function getBattery() {
  return new Promise(resolve => {
    exec('cat /sys/class/power_supply/battery/capacity 2>/dev/null || cat /sys/class/power_supply/Battery/capacity 2>/dev/null',
      (err, stdout) => {
      if (err || !stdout.trim()) return resolve(null);
      const percent = parseInt(stdout.trim());
      exec('cat /sys/class/power_supply/battery/status 2>/dev/null || cat /sys/class/power_supply/Battery/status 2>/dev/null',
        (err2, stdout2) => {
        const status = stdout2?.trim() || 'Unknown';
        resolve({ percent, status, charging: status.toLowerCase().includes('charging') });
      });
    });
  });
}

async function gatherMetrics() {
  const now = Date.now();
  if (metricsCache && now - cacheTimestamp < CACHE_TTL) return metricsCache;

  try {
    const [cpu, cpuLoad, mem, fsSize, networkStats, osInfo, time, diskIO, connections, battery] = await Promise.all([
      si.cpu(), si.currentLoad(), si.mem(), si.fsSize(),
      si.networkStats(), si.osInfo(), si.time(),
      getDiskIO(), getConnections(), getBattery(),
    ]);

    const pm2List = await getPm2Apps();
    const netIf = networkStats[0] || {};
    const termuxNet = await getNetworkFromTermux();

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
        perCore: cpuLoad.cpus?.slice(0, 8).map((c, i) => ({ core: i, load: parseFloat(c.load.toFixed(1)) })) || [],
      },

      memory: {
        totalMB:      Math.round(mem.total / 1024 / 1024),
        usedMB:       Math.round(mem.used  / 1024 / 1024),
        freeMB:       Math.round(mem.free  / 1024 / 1024),
        cachedMB:     Math.round((mem.cached || 0) / 1024 / 1024),
        swapTotalMB:  Math.round((mem.swaptotal || 0) / 1024 / 1024),
        swapUsedMB:   Math.round((mem.swapused  || 0) / 1024 / 1024),
        usagePercent: parseFloat(((mem.used / mem.total) * 100).toFixed(1)),
      },

      storage: fsSize.filter(fs => fs.size > 0).map(fs => ({
        device:       fs.fs,
        mount:        fs.mount,
        filesystem:   fs.type,
        totalGB:      parseFloat((fs.size  / 1e9).toFixed(1)),
        usedGB:       parseFloat((fs.used  / 1e9).toFixed(1)),
        freeGB:       parseFloat(((fs.size - fs.used) / 1e9).toFixed(1)),
        usagePercent: parseFloat(fs.use.toFixed(1)),
      })),

      diskIO,

      network: {
        iface:       termuxNet?.iface || netIf.iface || 'wlan0',
        rxMBs:       termuxNet?.rxMBs ?? parseFloat(((netIf.rx_sec || 0) / 1024 / 1024).toFixed(3)),
        txMBs:       termuxNet?.txMBs ?? parseFloat(((netIf.tx_sec || 0) / 1024 / 1024).toFixed(3)),
        rxTotal:     formatBytes(netIf.rx_bytes || 0),
        txTotal:     formatBytes(netIf.tx_bytes || 0),
        connections: connections.established,
      },

      battery,
      pm2Apps: pm2List,

      summary: {
        totalProjects:    db.prepare('SELECT COUNT(*) as c FROM projects').get().c,
        runningProjects:  db.prepare("SELECT COUNT(*) as c FROM projects WHERE status = 'ready'").get().c,
        errorProjects:    db.prepare("SELECT COUNT(*) as c FROM projects WHERE status = 'error'").get().c,
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

function formatUptime(s) {
  const d = Math.floor(s/86400), h = Math.floor((s%86400)/3600),
        m = Math.floor((s%3600)/60), sc = Math.floor(s%60);
  return `${d}d ${h}h ${m}m ${sc}s`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
  if (bytes < 1024**3)   return `${(bytes/1024/1024).toFixed(1)} MB`;
  return `${(bytes/1024/1024/1024).toFixed(2)} GB`;
}

function getPm2Apps() {
  return new Promise(resolve => {
    exec('pm2 jlist 2>/dev/null', (err, stdout) => {
      if (err || !stdout.trim()) return resolve([]);
      try {
        resolve(JSON.parse(stdout).map(p => ({
          name:     p.name,
          pid:      p.pid,
          status:   p.pm2_env?.status || 'unknown',
          cpu:      p.monit?.cpu    || 0,
          memMB:    Math.round((p.monit?.memory || 0) / 1024 / 1024),
          uptime:   p.pm2_env?.pm_uptime ? formatUptime((Date.now() - p.pm2_env.pm_uptime) / 1000) : '-',
          restarts: p.pm2_env?.restart_time || 0,
        })));
      } catch { resolve([]); }
    });
  });
}

router.get('/', async (req, res) => {
  try {
    res.json(await gatherMetrics());
  } catch (err) {
    res.status(500).json({ error: 'Gagal ambil metrics.' });
  }
});

router.get('/speed', async (req, res) => {
  try {
    res.json(await getInternetSpeed());
  } catch (err) {
    res.status(500).json({ error: 'Gagal test kecepatan.' });
  }
});

module.exports = { router, gatherMetrics };

// Override network stats dengan data dari Termux bridge
async function getNetworkFromTermux() {
  try {
    const fs = require('fs');
    const content = fs.readFileSync('/root/net_stats', 'utf8').trim();
    const parts = content.split(' ').map(Number);
    if (parts.length >= 2) {
      return {
        iface:       'wlan0',
        rxMBs:       parseFloat((parts[0] / 1024 / 1024).toFixed(3)),
        txMBs:       parseFloat((parts[1] / 1024 / 1024).toFixed(3)),
        rxTotal:     parts[2] ? formatBytes(parts[2]) : '0 B',
        txTotal:     parts[3] ? formatBytes(parts[3]) : '0 B',
        connections: 0,
      };
    }
  } catch {}
  return null;
}
