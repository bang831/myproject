// routes/files.js - File Manager
const express = require('express');
const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const { authMiddleware } = require('../middleware/auth');
const { db } = require('../db');

const router = express.Router();
router.use(authMiddleware);

const APPS_DIR = process.env.APPS_DIR || path.join(os.homedir(), 'apps');

// Helper: validasi path aman (tidak boleh keluar dari apps dir)
function safePath(appId, relativePath = '') {
  const appDir  = path.join(APPS_DIR, appId);
  const full    = path.resolve(path.join(appDir, relativePath));
  if (!full.startsWith(appDir)) throw new Error('Path tidak aman!');
  return { full, appDir };
}

// GET /api/files/:appId?path=xxx - List files/folders
router.get('/:appId', (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE app_id = ? AND user_id = ?')
      .get(req.params.appId, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan.' });

    const { full } = safePath(req.params.appId, req.query.path || '');
    if (!fs.existsSync(full)) return res.status(404).json({ error: 'Path tidak ditemukan.' });

    const stat = fs.statSync(full);
    if (!stat.isDirectory()) return res.status(400).json({ error: 'Bukan direktori.' });

    const entries = fs.readdirSync(full).map(name => {
      const entryPath = path.join(full, name);
      const entryStat = fs.statSync(entryPath);
      return {
        name,
        type:     entryStat.isDirectory() ? 'dir' : 'file',
        size:     entryStat.size,
        modified: entryStat.mtime.toISOString(),
        ext:      path.extname(name).toLowerCase(),
      };
    }).sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    res.json({ path: req.query.path || '/', entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/files/:appId/read?path=xxx - Baca isi file
router.get('/:appId/read', (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE app_id = ? AND user_id = ?')
      .get(req.params.appId, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan.' });

    const { full } = safePath(req.params.appId, req.query.path);
    if (!fs.existsSync(full)) return res.status(404).json({ error: 'File tidak ditemukan.' });

    const stat = fs.statSync(full);
    if (stat.isDirectory()) return res.status(400).json({ error: 'Ini adalah direktori.' });
    if (stat.size > 2 * 1024 * 1024) return res.status(400).json({ error: 'File terlalu besar (max 2MB).' });

    const content = fs.readFileSync(full, 'utf8');
    res.json({ content, size: stat.size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/files/:appId/write - Tulis/simpan file
router.post('/:appId/write', (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE app_id = ? AND user_id = ?')
      .get(req.params.appId, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan.' });

    const { path: filePath, content } = req.body;
    const { full } = safePath(req.params.appId, filePath);

    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
    res.json({ ok: true, message: 'File disimpan.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/files/:appId/mkdir - Buat folder
router.post('/:appId/mkdir', (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE app_id = ? AND user_id = ?')
      .get(req.params.appId, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan.' });

    const { path: dirPath } = req.body;
    const { full } = safePath(req.params.appId, dirPath);
    fs.mkdirSync(full, { recursive: true });
    res.json({ ok: true, message: 'Folder dibuat.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/files/:appId/rename - Rename file/folder
router.post('/:appId/rename', (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE app_id = ? AND user_id = ?')
      .get(req.params.appId, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan.' });

    const { oldPath, newPath } = req.body;
    const { full: oldFull } = safePath(req.params.appId, oldPath);
    const { full: newFull } = safePath(req.params.appId, newPath);

    fs.renameSync(oldFull, newFull);
    res.json({ ok: true, message: 'Berhasil direname.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/files/:appId/delete?path=xxx - Hapus file/folder
router.delete('/:appId/delete', (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE app_id = ? AND user_id = ?')
      .get(req.params.appId, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan.' });

    const { full } = safePath(req.params.appId, req.query.path);
    if (!fs.existsSync(full)) return res.status(404).json({ error: 'File tidak ditemukan.' });

    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      fs.rmSync(full, { recursive: true, force: true });
    } else {
      fs.unlinkSync(full);
    }
    res.json({ ok: true, message: 'Berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
