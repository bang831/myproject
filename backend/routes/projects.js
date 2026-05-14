const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const os      = require('os');

const { db, generateAppId } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const deployer = require('../lib/deployer');

const router = express.Router();

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.zip','.html','.htm','.css','.js','.ts','.tsx','.jsx','.json','.png','.jpg','.jpeg','.gif','.svg','.ico','.txt','.md','.env','.example','.gitignore','.sh','.yml','.yaml','.toml','.lock','.map','.woff','.woff2','.ttf','.eot','.py','.rb','.php','.go','.rs','.java','.kt','.swift','.c','.cpp','.h'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext) || file.mimetype === 'application/zip') cb(null, true);
    else cb(new Error(`File ${ext} tidak didukung`));
  },
});

router.use(authMiddleware);

router.get('/', (req, res) => {
  try {
    const projects = db.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM deployments d WHERE d.project_id = p.id) as deployment_count,
        (SELECT created_at FROM deployments d WHERE d.project_id = p.id ORDER BY id DESC LIMIT 1) as last_deployed
      FROM projects p WHERE p.user_id = ? ORDER BY p.id DESC
    `).all(req.user.id);
    res.json(projects.map(p => ({ ...p, env_vars: undefined })));
  } catch (err) { res.status(500).json({ error: 'Gagal ambil projects.' }); }
});

router.get('/:id', (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan.' });
    res.json({ ...project, env_vars: undefined });
  } catch (err) { res.status(500).json({ error: 'Gagal ambil project.' }); }
});

router.post('/', upload.array('files', 500), async (req, res) => {
  const { name, repo_url, branch, framework, cf_zone_id, cf_domain, cf_subdomain, env_vars, start_command, root_path } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'Nama project wajib diisi.' });
  if (!repo_url && (!req.files || req.files.length === 0)) return res.status(400).json({ error: 'Wajib upload file atau isi URL repo.' });
  if (!cf_domain) return res.status(400).json({ error: 'Domain wajib dipilih.' });

  try {
    const appId = generateAppId();
    const result = db.prepare(`
      INSERT INTO projects (app_id, user_id, name, repo_url, branch, framework, status, env_vars)
      VALUES (?, ?, ?, ?, ?, ?, 'building', ?)
    `).run(appId, req.user.id, name.trim(), repo_url?.trim() || null, branch?.trim() || 'main', framework || 'static', env_vars || '{}');

    const projectId = result.lastInsertRowid;
    const depResult = db.prepare(`INSERT INTO deployments (project_id, status, commit_message) VALUES (?, 'building', 'Initial deployment')`).run(projectId);
    const deploymentId = depResult.lastInsertRowid;
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);

    res.status(201).json({ project: { ...project, env_vars: undefined }, deployment_id: deploymentId, message: 'Deploy dimulai!' });

    const uploadedFiles = req.files || [];
    let zipPath = null;

    if (uploadedFiles.length > 0) {
      const zipFile = uploadedFiles.find(f => path.extname(f.originalname).toLowerCase() === '.zip');
      if (zipFile) {
        zipPath = zipFile.path;
      } else {
        const tempDir = path.join(os.tmpdir(), `upload-${appId}`);
        fs.mkdirSync(tempDir, { recursive: true });
        for (const f of uploadedFiles) {
          const destPath = path.join(tempDir, f.originalname);
          const destDir  = path.dirname(destPath);
          fs.mkdirSync(destDir, { recursive: true });
          fs.copyFileSync(f.path, destPath);
          fs.unlinkSync(f.path);
        }
        const AdmZip = require('adm-zip');
        const zip = new AdmZip();
        zip.addLocalFolder(tempDir);
        zipPath = path.join(os.tmpdir(), `${appId}.zip`);
        zip.writeZip(zipPath);
        fs.rmSync(tempDir, { recursive: true });
      }
    }

    deployer.deploy({
      project, deploymentId, zipPath,
      cfZoneId: cf_zone_id || null,
      cfDomain: cf_domain,
      cfSubdomain: cf_subdomain || name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      startCommand: start_command || null,
      rootPath: root_path || null,
    }).catch(err => console.error(`[DEPLOY ${appId}]`, err.message))
      .finally(() => { if (zipPath && fs.existsSync(zipPath)) fs.unlinkSync(zipPath); });

  } catch (err) {
    console.error('[PROJECTS POST]', err);
    res.status(500).json({ error: 'Gagal membuat project.' });
  }
});

router.post('/:id/redeploy', async (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan.' });
    if (project.status === 'building') return res.status(409).json({ error: 'Sedang deploy.' });
    res.json({ message: 'Redeploy dimulai!' });
    deployer.redeploy(project).catch(err => console.error(err.message));
  } catch (err) { res.status(500).json({ error: 'Gagal redeploy.' }); }
});

router.get('/:id/logs', async (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan.' });
    const logs = await deployer.getLogs(project, parseInt(req.query.lines) || 200);
    res.json({ logs });
  } catch (err) { res.status(500).json({ error: 'Gagal ambil logs.' }); }
});

// GET /api/projects/:id/files - List HTML files
router.get('/:id/files', (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan.' });
    const nginx = require('../lib/nginx');
    const appDir = path.join(nginx.STATIC_ROOT, project.app_id);
    // Cari semua HTML files rekursif
    const htmlFiles = [];
    function findHtml(dir, base = '') {
      if (!fs.existsSync(dir)) return;
      fs.readdirSync(dir).forEach(f => {
        const full = path.join(dir, f);
        const rel  = base ? `${base}/${f}` : f;
        if (fs.statSync(full).isDirectory()) findHtml(full, rel);
        else if (f.endsWith('.html') || f.endsWith('.htm')) htmlFiles.push(rel);
      });
    }
    findHtml(appDir);
    res.json({ files: htmlFiles });
  } catch (err) { res.status(500).json({ error: 'Gagal list files.' }); }
});

// POST /api/projects/:id/set-index - Set homepage file
router.post('/:id/set-index', async (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan.' });

    const { index_file } = req.body;
    const nginx = require('../lib/nginx');
    const filePath = path.join(nginx.STATIC_ROOT, project.app_id, index_file);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: `File ${index_file} tidak ditemukan.` });

    // Ambil folder dari path file
    const rootPath = path.dirname(index_file) === '.' ? '' : path.dirname(index_file);
    const staticPath = rootPath
      ? path.join(nginx.STATIC_ROOT, project.app_id, rootPath)
      : path.join(nginx.STATIC_ROOT, project.app_id);

    nginx.writeConfig({
      appId: project.app_id,
      domain: project.domain,
      port: project.port,
      projectType: 'static',
      staticPath,
      indexFile: path.basename(index_file),
    });

    await nginx.reloadNginx();
    res.json({ ok: true, message: `Homepage diset ke ${index_file}` });
  } catch (err) { res.status(500).json({ error: 'Gagal set index.' }); }
});

// POST /api/projects/:id/set-path - Set root path manual
router.post('/:id/set-path', async (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan.' });

    const { root_path, index_file, start_command, backend_path } = req.body;
    const nginx = require('../lib/nginx');

    if (start_command) {
      // Backend mode - update PM2
      const appDir = path.join(process.env.APPS_DIR || `${os.homedir()}/apps`, project.app_id, backend_path || "");
      const { exec } = require('child_process');
      const pm2Name = `deployflow-${project.app_id}`;
      exec(`pm2 delete "${pm2Name}" 2>/dev/null; cd "${appDir}" && PORT=${project.port} pm2 start ${start_command} --name "${pm2Name}"`, (err) => {
        if (err) return res.status(500).json({ error: 'Gagal start backend: ' + err.message });
        db.prepare("UPDATE projects SET project_type = 'node' WHERE id = ?").run(project.id);
        res.json({ ok: true, message: `Backend started: ${start_command}` });
      });
      return;
    }

    // Static mode - update root path
    const staticPath = root_path
      ? path.join(nginx.STATIC_ROOT, project.app_id, root_path)
      : path.join(nginx.STATIC_ROOT, project.app_id);

    if (!fs.existsSync(staticPath)) {
      return res.status(404).json({ error: `Path "${root_path}" tidak ditemukan di project.` });
    }

    nginx.writeConfig({
      appId: project.app_id,
      domain: project.domain,
      port: project.port,
      projectType: 'static',
      staticPath,
      indexFile: index_file || 'index.html',
    });

    await nginx.reloadNginx();
    res.json({ ok: true, message: `Root path diset ke /${root_path || ''}` });
  } catch (err) { res.status(500).json({ error: 'Gagal set path: ' + err.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan.' });
    const { env_vars, branch } = req.body;
    const updates = []; const params = [];
    if (env_vars !== undefined) { updates.push('env_vars = ?'); params.push(JSON.stringify(env_vars)); }
    if (branch !== undefined)   { updates.push('branch = ?');   params.push(branch); }
    if (!updates.length) return res.json({ message: 'Tidak ada yang diupdate.' });
    updates.push("updated_at = datetime('now')");
    params.push(req.params.id, req.user.id);
    db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...params);
    res.json({ ...db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id), env_vars: undefined });
  } catch (err) { res.status(500).json({ error: 'Gagal update.' }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan.' });
    res.json({ message: 'Menghapus...' });
    deployer.deleteProject(project).finally(() => {
      db.prepare('DELETE FROM deployments WHERE project_id = ?').run(project.id);
      db.prepare('DELETE FROM projects WHERE id = ?').run(project.id);
    });
  } catch (err) { res.status(500).json({ error: 'Gagal hapus.' }); }
});

module.exports = router;

// GET /api/projects/:id/env - Ambil env vars
router.get('/:id/env', (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan.' });
    try {
      const vars = JSON.parse(project.env_vars || '{}');
      res.json({ env_vars: vars });
    } catch { res.json({ env_vars: {} }); }
  } catch (err) { res.status(500).json({ error: 'Gagal ambil env vars.' }); }
});

// POST /api/projects/:id/env - Simpan env vars
router.post('/:id/env', (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan.' });

    const { env_vars } = req.body;
    db.prepare('UPDATE projects SET env_vars = ? WHERE id = ?')
      .run(JSON.stringify(env_vars || {}), project.id);

    // Tulis ulang .env file di folder app
    const appDir = path.join(process.env.APPS_DIR || `${os.homedir()}/apps`, project.app_id);
    if (fs.existsSync(appDir)) {
      const envContent = Object.entries(env_vars || {})
        .map(([k, v]) => `${k}=${v}`).join('\n');
      fs.writeFileSync(path.join(appDir, '.env'), envContent, 'utf8');
    }

    // Restart PM2 kalau ada
    if (project.pm2_name) {
      const { exec } = require('child_process');
      exec(`pm2 restart "${project.pm2_name}"`, () => {});
    }

    res.json({ ok: true, message: 'Environment variables disimpan.' });
  } catch (err) { res.status(500).json({ error: 'Gagal simpan env vars.' }); }
});

// POST /api/projects/:id/env/import - Import dari .env file content
router.post('/:id/env/import', (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan.' });

    const { content } = req.body;
    const vars = {};

    content.split("\n").forEach((line) => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const eq = line.indexOf('=');
      if (eq === -1) return;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key) vars[key] = val;
    });

    db.prepare('UPDATE projects SET env_vars = ? WHERE id = ?')
      .run(JSON.stringify(vars), project.id);

    const appDir = path.join(process.env.APPS_DIR || `${os.homedir()}/apps`, project.app_id);
    if (fs.existsSync(appDir)) {
      fs.writeFileSync(path.join(appDir, '.env'), content, 'utf8');
    }

    res.json({ ok: true, vars, count: Object.keys(vars).length });
  } catch (err) { res.status(500).json({ error: 'Gagal import .env.' }); }
});
