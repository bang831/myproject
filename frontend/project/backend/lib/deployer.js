// lib/deployer.js - Core Deploy Engine
// Flow: extract/clone → detect type → install → build/pm2 → nginx → cloudflare
const fs     = require('fs');
const path   = require('path');
const { exec, execSync } = require('child_process');
const AdmZip = require('adm-zip');
const simpleGit = require('simple-git');

const { db, assignPort, releasePort } = require('../db');
const nginx   = require('./nginx');
const cf      = require('./cloudflare');

const APPS_DIR = process.env.APPS_DIR || path.join(require('os').homedir(), 'apps');

// Pastikan direktori apps ada
if (!fs.existsSync(APPS_DIR)) fs.mkdirSync(APPS_DIR, { recursive: true });

// ─── WebSocket Log Emitter ─────────────────────────────────────────────────
let _wss = null;
function setWss(wss) { _wss = wss; }

function emitLog(appId, line) {
  if (!_wss) return;
  const msg = JSON.stringify({ type: 'deploy_log', appId, line, ts: Date.now() });
  _wss.clients.forEach(client => {
    if (client.readyState === 1 && client._subscriptions?.has(`deploy:${appId}`)) {
      client.send(msg);
    }
  });
}

function emitStatus(appId, status) {
  if (!_wss) return;
  const msg = JSON.stringify({ type: 'deploy_status', appId, status, ts: Date.now() });
  _wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

// ─── Detect Project Type ───────────────────────────────────────────────────
function detectProjectType(dir) {
  const has = (f) => fs.existsSync(path.join(dir, f));

  if (has('next.config.js') || has('next.config.ts') || has('next.config.mjs')) return 'nextjs';
  if (has('vite.config.js') || has('vite.config.ts')) return 'vite';
  if (has('package.json')) {
    // Cek scripts di package.json
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      if (pkg.scripts?.start) return 'node';
    } catch {}
    return 'node';
  }
  if (has('index.html')) return 'static';

  return 'static';
}

// ─── Run Command dengan Log Stream ─────────────────────────────────────────
function runCommand(cmd, cwd, appId, deploymentId, logLabel) {
  return new Promise((resolve, reject) => {
    emitLog(appId, `$ ${logLabel || cmd}`);

    const proc = exec(cmd, { cwd, env: { ...process.env, CI: 'false' } });

    let output = '';

    proc.stdout.on('data', (d) => {
      d.split('\n').forEach(line => {
        if (line.trim()) {
          emitLog(appId, line);
          output += line + '\n';
          appendDeployLog(deploymentId, line);
        }
      });
    });

    proc.stderr.on('data', (d) => {
      d.split('\n').forEach(line => {
        if (line.trim()) {
          emitLog(appId, `  ${line}`);
          output += line + '\n';
          appendDeployLog(deploymentId, line);
        }
      });
    });

    proc.on('close', (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`Command "${cmd}" exit code ${code}`));
    });
  });
}

// ─── Append log ke DB ─────────────────────────────────────────────────────
function appendDeployLog(deploymentId, line) {
  try {
    const current = db.prepare('SELECT logs FROM deployments WHERE id = ?').get(deploymentId);
    const newLogs = (current?.logs || '') + line + '\n';
    db.prepare('UPDATE deployments SET logs = ? WHERE id = ?').run(newLogs, deploymentId);
  } catch {}
}

// ─── PM2 Manager ──────────────────────────────────────────────────────────
function pm2Start(name, cwd, port, framework) {
  return new Promise((resolve, reject) => {
    // Set PORT env variable untuk app
    const envStr = `PORT=${port}`;
    let startCmd;

    if (framework === 'nextjs') {
      startCmd = `pm2 start npm --name "${name}" -- start -- -p ${port}`;
    } else {
      startCmd = `pm2 start npm --name "${name}" -- start`;
    }

    exec(`${envStr} ${startCmd}`, { cwd }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

function pm2Stop(name) {
  return new Promise((resolve) => {
    exec(`pm2 stop "${name}" && pm2 delete "${name}"`, () => resolve());
  });
}

function pm2Restart(name) {
  return new Promise((resolve, reject) => {
    exec(`pm2 restart "${name}"`, (err, stdout) => {
      if (err) reject(new Error(err.message));
      else resolve(stdout);
    });
  });
}

function pm2Logs(name, lines = 100) {
  return new Promise((resolve) => {
    exec(`pm2 logs "${name}" --nostream --lines ${lines}`, (err, stdout, stderr) => {
      resolve(stdout + stderr);
    });
  });
}

// ─── MAIN DEPLOY FUNCTION ─────────────────────────────────────────────────
async function deploy({
  project,
  deploymentId,
  zipPath,        // null jika dari github
  cfZoneId,
  cfDomain,
  cfSubdomain,
}) {
  const appId   = project.app_id;
  const appDir  = path.join(APPS_DIR, appId);
  const startMs = Date.now();

  const log = (msg) => {
    emitLog(appId, msg);
    appendDeployLog(deploymentId, msg);
    console.log(`[${appId}] ${msg}`);
  };

  try {
    // ── Step 1: Prepare directory ──────────────────────────────────────────
    log('📁 Menyiapkan direktori project...');
    if (fs.existsSync(appDir)) {
      fs.rmSync(appDir, { recursive: true, force: true });
    }
    fs.mkdirSync(appDir, { recursive: true });

    // ── Step 2: Extract ZIP or Clone Repo ─────────────────────────────────
    if (zipPath) {
      log('📦 Mengekstrak ZIP...');
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(appDir, true);

      // Kalau ada satu folder di dalam ZIP, masuk ke dalamnya
      const entries = fs.readdirSync(appDir);
      if (entries.length === 1 && fs.statSync(path.join(appDir, entries[0])).isDirectory()) {
        const innerDir = path.join(appDir, entries[0]);
        const files = fs.readdirSync(innerDir);
        files.forEach(f => {
          fs.renameSync(path.join(innerDir, f), path.join(appDir, f));
        });
        fs.rmdirSync(innerDir);
      }
      log('✅ ZIP berhasil diekstrak.');
    } else if (project.repo_url) {
      log(`🔗 Clone repository: ${project.repo_url} (branch: ${project.branch || 'main'})`);
      const git = simpleGit();
      await git.clone(project.repo_url, appDir, ['--branch', project.branch || 'main', '--depth', '1']);
      log('✅ Repository berhasil di-clone.');
    }

    // ── Step 3: Detect Project Type ───────────────────────────────────────
    const projectType = detectProjectType(appDir);
    log(`🔍 Tipe project terdeteksi: ${projectType.toUpperCase()}`);

    db.prepare('UPDATE projects SET project_type = ? WHERE app_id = ?').run(projectType, appId);

    // ── Step 4: Assign Port ───────────────────────────────────────────────
    let port = project.port;
    if (!port) {
      port = assignPort(appId);
      db.prepare('UPDATE projects SET port = ? WHERE app_id = ?').run(port, appId);
      log(`🔌 Port ditetapkan: ${port}`);
    }

    // ── Step 5: Install Dependencies ─────────────────────────────────────
    const hasPackageJson = fs.existsSync(path.join(appDir, 'package.json'));
    if (hasPackageJson && projectType !== 'static') {
      log('📦 Menginstall dependencies... (npm install)');
      await runCommand('npm install --legacy-peer-deps', appDir, appId, deploymentId, 'npm install');
      log('✅ Dependencies berhasil diinstall.');
    }

    // ── Step 6: Write env vars ────────────────────────────────────────────
    if (project.env_vars) {
      try {
        const envVars = JSON.parse(project.env_vars);
        const envLines = Object.entries(envVars).map(([k, v]) => `${k}=${v}`).join('\n');
        if (envLines) {
          fs.writeFileSync(path.join(appDir, '.env'), envLines, 'utf8');
          log('⚙️ Environment variables ditulis ke .env');
        }
      } catch {}
    }

    // ── Step 7: Build ────────────────────────────────────────────────────
    if (projectType === 'vite' || projectType === 'nextjs') {
      log(`🔨 Building project... (npm run build)`);
      await runCommand(`PORT=${port} npm run build`, appDir, appId, deploymentId, 'npm run build');
      log('✅ Build berhasil!');
    }

    // ── Step 8: Start/Deploy ─────────────────────────────────────────────
    const pm2Name = `deployflow-${appId}`;

    if (projectType === 'static') {
      // Copy ke /var/www/appId
      const staticPath = path.join(nginx.STATIC_ROOT, appId);
      if (fs.existsSync(staticPath)) fs.rmSync(staticPath, { recursive: true });
      fs.mkdirSync(staticPath, { recursive: true });

      // Kalau vite build ada di dist/, kalau nextjs di out/, kalau static langsung
      const distDir = ['dist', 'out', 'build', '.next/static', ''].find(d =>
        fs.existsSync(path.join(appDir, d, 'index.html')) ||
        (d === '' && fs.existsSync(path.join(appDir, 'index.html')))
      );
      const srcDir = distDir ? path.join(appDir, distDir) : appDir;

      execSync(`cp -r "${srcDir}/." "${staticPath}/"`);
      db.prepare('UPDATE projects SET pm2_name = NULL WHERE app_id = ?').run(appId);
      log(`📁 Static files di-copy ke ${staticPath}`);
    } else if (projectType === 'vite') {
      // Setelah build vite, serve static dist/
      const staticPath = path.join(nginx.STATIC_ROOT, appId);
      if (fs.existsSync(staticPath)) fs.rmSync(staticPath, { recursive: true });
      fs.mkdirSync(staticPath, { recursive: true });

      const distDir = path.join(appDir, 'dist');
      if (fs.existsSync(distDir)) {
        execSync(`cp -r "${distDir}/." "${staticPath}/"`);
        log(`📁 Vite dist/ di-copy ke ${staticPath}`);
      }
    } else {
      // Node / Next.js - start dengan PM2
      // Stop jika ada yang jalan sebelumnya
      await pm2Stop(pm2Name).catch(() => {});
      log(`🚀 Menjalankan app dengan PM2: ${pm2Name} (port ${port})`);
      await pm2Start(pm2Name, appDir, port, projectType);
      db.prepare('UPDATE projects SET pm2_name = ? WHERE app_id = ?').run(pm2Name, appId);
      log(`✅ App berjalan di PM2! (port ${port})`);
    }

    // ── Step 9: Nginx Config ──────────────────────────────────────────────
    const staticPath = ['vite', 'static'].includes(projectType)
      ? path.join(nginx.STATIC_ROOT, appId)
      : null;

    const fullDomain = cfSubdomain ? `${cfSubdomain}.${cfDomain}` : cfDomain;
    log(`🌐 Membuat Nginx config untuk ${fullDomain}...`);

    const { filename: nginxFile } = nginx.writeConfig({
      appId,
      domain: fullDomain,
      port,
      projectType: ['vite', 'static'].includes(projectType) ? 'static' : 'node',
      staticPath,
    });

    db.prepare('UPDATE projects SET nginx_file = ?, domain = ?, subdomain = ? WHERE app_id = ?')
      .run(nginxFile, fullDomain, cfSubdomain, appId);

    // Test & reload nginx
    const nginxTest = nginx.testConfig();
    if (nginxTest.ok) {
      log('✅ Nginx config valid.');
      await nginx.reloadNginx();
      log('🔄 Nginx berhasil di-reload.');
    } else {
      log(`⚠️ Nginx config warning: ${nginxTest.error}`);
    }

    // ── Step 10: Cloudflare DNS ───────────────────────────────────────────
    if (cfZoneId && cfDomain) {
      try {
        log(`☁️  Membuat DNS record: ${fullDomain} → Cloudflare Tunnel...`);
        const record = await cf.createDnsRecord({
          zoneId:    cfZoneId,
          subdomain: cfSubdomain,
          domain:    cfDomain,
        });
        db.prepare('UPDATE projects SET cf_record_id = ? WHERE app_id = ?').run(record.id, appId);
        log(`✅ DNS record berhasil dibuat! (ID: ${record.id})`);
        log(`🎉 Website online: https://${fullDomain}`);
      } catch (cfErr) {
        log(`⚠️  Cloudflare DNS error (lanjut tanpa DNS): ${cfErr.message}`);
      }
    }

    // ── Finalize ──────────────────────────────────────────────────────────
    const duration = Math.round((Date.now() - startMs) / 1000);
    db.prepare(`
      UPDATE deployments SET status = 'ready', duration = ? WHERE id = ?
    `).run(duration, deploymentId);
    db.prepare(`
      UPDATE projects SET status = 'ready', updated_at = datetime('now') WHERE app_id = ?
    `).run(appId);

    emitStatus(appId, 'ready');
    log(`\n🎉 Deploy selesai dalam ${duration} detik!`);

    return { success: true, domain: fullDomain, port, projectType, duration };

  } catch (err) {
    const errMsg = err.message || String(err);
    log(`\n❌ DEPLOY GAGAL: ${errMsg}`);

    db.prepare(`UPDATE deployments SET status = 'error', logs = logs || ? WHERE id = ?`)
      .run('\n❌ ' + errMsg, deploymentId);
    db.prepare(`UPDATE projects SET status = 'error', updated_at = datetime('now') WHERE app_id = ?`)
      .run(appId);

    emitStatus(appId, 'error');
    throw err;
  }
}

// ─── REDEPLOY ─────────────────────────────────────────────────────────────
async function redeploy(project) {
  const appId  = project.app_id;
  const appDir = path.join(APPS_DIR, appId);
  const log = (msg) => emitLog(appId, msg);

  // Create new deployment record
  const depResult = db.prepare(`
    INSERT INTO deployments (project_id, status, commit_message) VALUES (?, 'building', 'Redeployment')
  `).run(project.id);
  const deploymentId = depResult.lastInsertRowid;

  db.prepare("UPDATE projects SET status = 'building' WHERE app_id = ?").run(appId);
  emitStatus(appId, 'building');

  try {
    // Git pull jika dari repo
    if (project.repo_url && fs.existsSync(path.join(appDir, '.git'))) {
      log('🔄 git pull...');
      const git = simpleGit(appDir);
      await git.pull('origin', project.branch || 'main');
      log('✅ Pull selesai.');
    }

    // Reinstall
    if (fs.existsSync(path.join(appDir, 'package.json'))) {
      log('📦 npm install...');
      await runCommand('npm install --legacy-peer-deps', appDir, appId, deploymentId, 'npm install');
    }

    // Rebuild
    const projectType = project.project_type || detectProjectType(appDir);
    if (projectType === 'vite' || projectType === 'nextjs') {
      log('🔨 npm run build...');
      await runCommand(`PORT=${project.port} npm run build`, appDir, appId, deploymentId, 'npm run build');
    }

    // Restart PM2 (untuk node/next)
    if (project.pm2_name) {
      log(`🔄 pm2 restart ${project.pm2_name}...`);
      await pm2Restart(project.pm2_name);
      log('✅ PM2 restarted!');
    }

    // Copy static jika perlu
    if (projectType === 'vite' || projectType === 'static') {
      const staticPath = path.join(nginx.STATIC_ROOT, appId);
      const distDir = path.join(appDir, 'dist');
      if (fs.existsSync(distDir)) {
        execSync(`cp -r "${distDir}/." "${staticPath}/"`);
        log('✅ Static files updated.');
      }
    }

    const duration = 0;
    db.prepare("UPDATE deployments SET status = 'ready', duration = ? WHERE id = ?").run(duration, deploymentId);
    db.prepare("UPDATE projects SET status = 'ready', updated_at = datetime('now') WHERE app_id = ?").run(appId);
    emitStatus(appId, 'ready');
    log('🎉 Redeploy berhasil!');
  } catch (err) {
    db.prepare("UPDATE deployments SET status = 'error' WHERE id = ?").run(deploymentId);
    db.prepare("UPDATE projects SET status = 'error', updated_at = datetime('now') WHERE app_id = ?").run(appId);
    emitStatus(appId, 'error');
    throw err;
  }
}

// ─── DELETE PROJECT ───────────────────────────────────────────────────────
async function deleteProject(project) {
  const appId  = project.app_id;
  const appDir = path.join(APPS_DIR, appId);
  const log = (msg) => console.log(`[DELETE ${appId}] ${msg}`);

  // 1. Stop PM2
  if (project.pm2_name) {
    log(`Stopping PM2: ${project.pm2_name}`);
    await pm2Stop(project.pm2_name).catch(() => {});
  }

  // 2. Remove nginx config
  if (project.nginx_file) {
    log(`Removing nginx config: ${project.nginx_file}`);
    nginx.removeConfig(project.nginx_file);
    await nginx.reloadNginx().catch(() => {});
  }

  // 3. Delete Cloudflare DNS
  if (project.cf_record_id) {
    try {
      const cfZoneId = db.prepare("SELECT value FROM settings WHERE key = 'cf_zone_id'").get()?.value;
      if (cfZoneId) {
        log(`Deleting CF DNS record: ${project.cf_record_id}`);
        await cf.deleteDnsRecord(cfZoneId, project.cf_record_id);
      }
    } catch (err) {
      log(`CF DNS delete warning: ${err.message}`);
    }
  }

  // 4. Release port
  if (project.port) releasePort(project.port);

  // 5. Delete files
  if (fs.existsSync(appDir)) {
    fs.rmSync(appDir, { recursive: true, force: true });
    log('Project files deleted.');
  }

  // 6. Delete static files
  const staticPath = path.join(nginx.STATIC_ROOT, appId);
  if (fs.existsSync(staticPath)) {
    fs.rmSync(staticPath, { recursive: true, force: true });
  }

  log('Project fully deleted.');
}

// ─── PM2 Logs ─────────────────────────────────────────────────────────────
async function getLogs(project, lines = 100) {
  if (project.pm2_name) {
    return pm2Logs(project.pm2_name, lines);
  }
  // Untuk static, return nginx access log kalau ada
  return 'App ini static, tidak ada runtime logs.\n';
}

module.exports = { deploy, redeploy, deleteProject, getLogs, setWss, pm2Stop, pm2Logs };
