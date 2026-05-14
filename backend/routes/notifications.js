const express = require('express');
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { getUptimeStats } = require('../lib/healthcheck');

const router = express.Router();
router.use(authMiddleware);

// GET /api/notifications - List notifikasi
router.get('/', (req, res) => {
  try {
    const notifs = db.prepare(`
      SELECT n.*, p.name as project_name, p.app_id
      FROM notifications n
      LEFT JOIN projects p ON p.id = n.project_id
      WHERE n.user_id = ?
      ORDER BY n.id DESC
      LIMIT 50
    `).all(req.user.id);
    res.json(notifs);
  } catch (err) { res.status(500).json({ error: 'Gagal ambil notifikasi.' }); }
});

// GET /api/notifications/unread - Jumlah belum dibaca
router.get('/unread', (req, res) => {
  try {
    const count = db.prepare("SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read = 0").get(req.user.id)?.c || 0;
    res.json({ count });
  } catch (err) { res.status(500).json({ error: 'Gagal.' }); }
});

// PUT /api/notifications/read-all - Tandai semua sudah dibaca
router.put('/read-all', (req, res) => {
  try {
    db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(req.user.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Gagal.' }); }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', (req, res) => {
  try {
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Gagal.' }); }
});

// DELETE /api/notifications - Hapus semua
router.delete('/', (req, res) => {
  try {
    db.prepare("DELETE FROM notifications WHERE user_id = ?").run(req.user.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Gagal.' }); }
});

// GET /api/notifications/uptime/:projectId
router.get('/uptime/:projectId', (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?')
      .get(req.params.projectId, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan.' });

    const stats7d  = getUptimeStats(project.id, 7);
    const stats30d = getUptimeStats(project.id, 30);
    const stats24h = getUptimeStats(project.id, 1);

    // Ambil log 24 jam terakhir per jam
    const hourly = db.prepare(`
      SELECT
        strftime('%H:00', checked_at) as hour,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up
      FROM uptime_logs
      WHERE project_id = ? AND checked_at > datetime('now', '-24 hours')
      GROUP BY strftime('%H', checked_at)
      ORDER BY hour
    `).all(project.id);

    res.json({ stats7d, stats30d, stats24h, hourly });
  } catch (err) { res.status(500).json({ error: 'Gagal ambil uptime.' }); }
});

module.exports = router;
