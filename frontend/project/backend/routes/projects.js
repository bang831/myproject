// routes/projects.js
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const os      = require('os');

const { db, generateAppId } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const deployer = require('../lib/deployer');

const router = express.Router();

// Upload ke temp folder
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file ZIP yang diizinkan'));
    }
  },
});

router.use(authMiddleware);

// ─── GET /api/projects ───────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const projects = db.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM deployments d WHERE d.project_id = p.id) as deployment_count,
        (SELECT created_at FROM deployments d WHERE d.project_id = p.id ORDER BY id DESC LIMIT 1) as last_deployed
      FROM projects p
      WHERE p.user_id = ?
      ORDER BY p.id DESC
    `).all(req.user.id);

    res.json(projects.map(p => ({
      ...p,
      env_vars: undefined, // Jangan kirim env vars ke client
    })));
  } catch (err) {
    console.error('[PROJECTS GET]', err);
    res.status(500).json({ error: 'Gagal ambil projects.' });
  }
});

// ─── GET /api/projects/:id ───────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const project = db.prepare(`
      SELECT * FROM projects WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);

    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan.' });

    res.json({ ...project, env_vars: undefined });
  } catch (err) {
    res.status(500).json({ error: 'Gagal ambil project.' });
  }
});

// ─── POST /api/projects - Create + Deploy ────────────────────────────────
// Bisa dari GitHub URL atau Upload ZIP
router.post('/', upload.single('zip'), async (req, res) => {
  const {
    name, repo_url, branch, framework,
    cf_zone_id, cf_domain, cf_subdomain,
    env_vars,
  } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: 'Nama project wajib diisi.' });
  }

  if (!repo_url && !req.file) {
    return res.status(400).json({ error: 'Wajib upload ZIP atau isi URL repo GitHub.' });
  }

  if (!cf_domain) {
    return res.status(400).json({ error: 'Domain wajib dipilih.' });
  }

  try {
    const appId = generateAppId();

    // Simpan project ke DB
    const result = db.prepare(`
      INSERT INTO projects (app_id, user_id, name, repo_url, branch, framework, status, env_vars)
      VALUES (?, ?, ?, ?, ?, ?, 'building', ?)
    `).run(
      appId,
      req.user.id,
      name.trim(),
      repo_url?.trim() || null,
      branch?.trim() || 'main',
      framework || 'react',
      env_vars || '{}',
    );

    const projectId = result.lastInsertRowid;

    // Buat deployment record
    const depResult = db.prepare(`
      INSERT INTO deployments (project_id, status, commit_message)
      VALUES (?, 'building', 'Initial deployment')
    `).run(projectId);
    const deploymentId = depResult.lastInsertRowid;

    // Ambil project full
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);

    // Respond langsung ke client, deploy jalan di background
    res.status(201).json({
      project: { ...project, env_vars: undefined },
      deployment_id: deploymentId,
      message: 'Deploy dimulai! Pantau log via WebSocket.',
    });

    // ── Background deploy ──────────────────────────────────────────────
    const zipPath = req.file?.path || null;

    deployer.deploy({
      project,
      deploymentId,
      zipPath,
      cfZoneId:    cf_zone_id || null,
      cfDomain:    cf_domain,
      cfSubdomain: cf_subdomain || name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    }).catch((err) => {
      console.error(`[DEPLOY ${appId}] Failed:`, err.message);
    }).finally(() => {
      // Hapus temp zip file
      if (zipPath && fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    });

  } catch (err) {
    console.error('[PROJECTS POST]', err);
    res.status(500).json({ error: 'Gagal membuat project.' });
  }
});

// ─── POST /api/projects/:id/redeploy ─────────────────────────────────────
router.post('/:id/redeploy', async (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);

    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan.' });
    if (project.status === 'building') {
      return res.status(409).json({ error: 'Project sedang dalam proses deploy.' });
    }

    res.json({ message: 'Redeploy dimulai!' });

    // Background redeploy
    deployer.redeploy(project).catch(err => {
      console.error(`[REDEPLOY ${project.app_id}]`, err.message);
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memulai redeploy.' });
  }
});

// ─── GET /api/projects/:id/logs ──────────────────────────────────────────
router.get('/:id/logs', async (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);

    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan.' });

    const logs = await deployer.getLogs(project, parseInt(req.query.lines) || 200);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: 'Gagal ambil logs.' });
  }
});

// ─── PUT /api/projects/:id - Update env vars / settings ──────────────────
router.put('/:id', (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);

    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan.' });

    const { env_vars, branch, status } = req.body;
    const updates = [];
    const params  = [];

    if (env_vars !== undefined) { updates.push('env_vars = ?'); params.push(JSON.stringify(env_vars)); }
    if (branch !== undefined)   { updates.push('branch = ?');   params.push(branch); }
    if (status !== undefined)   { updates.push('status = ?');   params.push(status); }

    if (updates.length === 0) return res.json({ message: 'Tidak ada yang diupdate.' });

    updates.push("updated_at = datetime('now')");
    params.push(req.params.id, req.user.id);

    db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...params);

    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    res.json({ ...updated, env_vars: undefined });
  } catch (err) {
    res.status(500).json({ error: 'Gagal update project.' });
  }
});

// ─── DELETE /api/projects/:id ────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);

    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan.' });

    res.json({ message: 'Project sedang dihapus...' });

    // Background delete
    deployer.deleteProject(project).then(() => {
      db.prepare('DELETE FROM deployments WHERE project_id = ?').run(project.id);
      db.prepare('DELETE FROM projects WHERE id = ?').run(project.id);
      console.log(`[DELETE] Project ${project.app_id} fully deleted.`);
    }).catch(err => {
      console.error(`[DELETE ${project.app_id}]`, err.message);
      // Still delete from DB even if cleanup failed
      db.prepare('DELETE FROM deployments WHERE project_id = ?').run(project.id);
      db.prepare('DELETE FROM projects WHERE id = ?').run(project.id);
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus project.' });
  }
});

module.exports = router;
