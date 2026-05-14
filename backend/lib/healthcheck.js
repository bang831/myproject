// lib/healthcheck.js - Auto health check + restart + notifikasi
const { exec } = require('child_process');
const { db }   = require('../db');
const path     = require('path');
const os       = require('os');

let _wss = null;
function setWss(wss) { _wss = wss; }

function notify(userId, type, title, message, projectId = null) {
  // Simpan ke DB
  try {
    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, project_id, read, created_at)
      VALUES (?, ?, ?, ?, ?, 0, datetime('now'))
    `).run(userId, type, title, message, projectId);
  } catch {}

  // Kirim via WebSocket
  if (_wss) {
    const msg = JSON.stringify({ type: 'notification', data: { type, title, message, projectId } });
    _wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
  }
}

// Cek apakah port responding
function checkPort(port, timeout = 5000) {
  return new Promise(resolve => {
    exec(`curl -s -o /dev/null -w "%{http_code}" http://localhost:${port} --max-time ${timeout/1000} 2>/dev/null`,
      (err, stdout) => {
        const code = parseInt(stdout) || 0;
        resolve({ alive: code > 0 && code < 600, statusCode: code });
      }
    );
  });
}

// Restart PM2 process
function restartPm2(name) {
  return new Promise((resolve, reject) => {
    exec(`pm2 restart "${name}" 2>/dev/null`, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

// Simpan uptime record
function recordUptime(projectId, status) {
  try {
    db.prepare(`
      INSERT INTO uptime_logs (project_id, status, checked_at)
      VALUES (?, ?, datetime('now'))
    `).run(projectId, status);

    // Hapus log lama (simpan 30 hari)
    db.prepare(`
      DELETE FROM uptime_logs
      WHERE project_id = ? AND checked_at < datetime('now', '-30 days')
    `).run(projectId);
  } catch {}
}

// ─── Main Health Check ────────────────────────────────────────────────────
async function runHealthCheck() {
  const projects = db.prepare(`
    SELECT * FROM projects WHERE status = 'ready' AND port IS NOT NULL
  `).all();

  for (const project of projects) {
    try {
      const { alive, statusCode } = await checkPort(project.port);

      if (alive) {
        // App sehat
        recordUptime(project.id, 'up');

        // Reset consecutive failures
        db.prepare('UPDATE projects SET health_failures = 0 WHERE id = ?').run(project.id);

      } else {
        // App tidak merespon
        recordUptime(project.id, 'down');

        const failures = (project.health_failures || 0) + 1;
        db.prepare('UPDATE projects SET health_failures = ? WHERE id = ?').run(failures, project.id);

        console.log(`[HEALTH] ${project.name} (${project.app_id}) tidak merespon! Failures: ${failures}`);

        if (failures === 1) {
          // Notifikasi pertama
          notify(project.user_id, 'warning', `⚠️ ${project.name} tidak merespon`,
            `Port ${project.port} tidak merespon. Mencoba restart...`, project.id);
        }

        // Auto restart PM2 kalau ada
        if (project.pm2_name && failures <= 3) {
          try {
            await restartPm2(project.pm2_name);
            console.log(`[HEALTH] ${project.name} berhasil di-restart`);

            // Tunggu 5 detik lalu cek lagi
            await new Promise(r => setTimeout(r, 5000));
            const { alive: aliveAfter } = await checkPort(project.port);

            if (aliveAfter) {
              notify(project.user_id, 'success', `✅ ${project.name} berhasil di-restart`,
                `App berhasil pulih setelah restart otomatis.`, project.id);
              db.prepare('UPDATE projects SET health_failures = 0 WHERE id = ?').run(project.id);
            } else {
              notify(project.user_id, 'error', `❌ ${project.name} gagal restart`,
                `App masih tidak merespon setelah restart. Perlu pengecekan manual.`, project.id);
            }
          } catch (err) {
            console.log(`[HEALTH] Gagal restart ${project.name}: ${err.message}`);
          }
        }

        // Kalau sudah 5x gagal, update status
        if (failures >= 5) {
          db.prepare("UPDATE projects SET status = 'error' WHERE id = ?").run(project.id);
          notify(project.user_id, 'error', `🔴 ${project.name} DOWN`,
            `App sudah ${failures}x gagal health check. Status diubah ke error.`, project.id);

          // Emit status via WS
          if (_wss) {
            const msg = JSON.stringify({ type: 'deploy_status', appId: project.app_id, status: 'error' });
            _wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
          }
        }
      }
    } catch (err) {
      console.error(`[HEALTH] Error cek ${project.name}:`, err.message);
    }
  }
}

// ─── Uptime Calculator ────────────────────────────────────────────────────
function getUptimeStats(projectId, days = 7) {
  try {
    const total = db.prepare(`
      SELECT COUNT(*) as c FROM uptime_logs
      WHERE project_id = ? AND checked_at > datetime('now', '-${days} days')
    `).get(projectId)?.c || 0;

    const up = db.prepare(`
      SELECT COUNT(*) as c FROM uptime_logs
      WHERE project_id = ? AND status = 'up' AND checked_at > datetime('now', '-${days} days')
    `).get(projectId)?.c || 0;

    return {
      uptime:  total > 0 ? parseFloat(((up / total) * 100).toFixed(2)) : null,
      total,
      up,
      down: total - up,
    };
  } catch { return { uptime: null, total: 0, up: 0, down: 0 }; }
}

module.exports = { runHealthCheck, getUptimeStats, notify, setWss };
