// routes/deployments.js
const express = require('express');
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/deployments?projectId=X
router.get('/', (req, res) => {
  try {
    const { projectId } = req.query;
    let deployments;

    if (projectId) {
      // Pastikan user punya akses ke project ini
      const project = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?')
        .get(projectId, req.user.id);
      if (!project) return res.status(404).json({ error: 'Project tidak ditemukan.' });

      deployments = db.prepare(`
        SELECT * FROM deployments WHERE project_id = ? ORDER BY id DESC LIMIT 50
      `).all(projectId);
    } else {
      // Semua deployments user
      deployments = db.prepare(`
        SELECT d.*, p.name as project_name, p.app_id
        FROM deployments d
        JOIN projects p ON p.id = d.project_id
        WHERE p.user_id = ?
        ORDER BY d.id DESC
        LIMIT 100
      `).all(req.user.id);
    }

    res.json(deployments);
  } catch (err) {
    console.error('[DEPLOYMENTS GET]', err);
    res.status(500).json({ error: 'Gagal ambil deployments.' });
  }
});

// GET /api/deployments/:id - Detail dengan full logs
router.get('/:id', (req, res) => {
  try {
    const dep = db.prepare(`
      SELECT d.*, p.name as project_name, p.app_id, p.user_id
      FROM deployments d
      JOIN projects p ON p.id = d.project_id
      WHERE d.id = ?
    `).get(req.params.id);

    if (!dep) return res.status(404).json({ error: 'Deployment tidak ditemukan.' });
    if (dep.user_id !== req.user.id) return res.status(403).json({ error: 'Akses ditolak.' });

    res.json(dep);
  } catch (err) {
    res.status(500).json({ error: 'Gagal ambil deployment.' });
  }
});

module.exports = router;
