// lib/deployer.js - Core Deploy Engine - FULL AUTO
const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const { exec, execSync } = require('child_process');
const AdmZip = require('adm-zip');
const simpleGit = require('simple-git');

const { db, assignPort, releasePort } = require('../db');
const nginx   = require('./nginx');
const cf      = require('./cloudflare');

const APPS_DIR = process.env.APPS_DIR || path.join(os.homedir(), 'apps');
if (!fs.existsSync(APPS_DIR)) fs.mkdirSync(APPS_DIR, { recursive: true });

let _wss = null;
function setWss(wss) { _wss = wss; }

function emitLog(appId, line) {
  if (!_wss) return;
  const msg = JSON.stringify({ type: 'deploy_log', appId, line, ts: Date.now() });
  _wss.clients.forEach(c => {
    if (c.readyState === 1 && c._subscriptions?.has(`deploy:${appId}`)) c.send(msg);
  });
}

function emitStatus(appId, status) {
  if (!_wss) return;
  const msg = JSON.stringify({ type: 'deploy_status', appId, status, ts: Date.now() });
  _wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
}

function appendDeployLog(deploymentId, line) {
  try {
    const cur = db.prepare('SELECT logs FROM deployments WHERE id = ?').get(deploymentId);
    db.prepare('UPDATE deployments SET logs = ? WHERE id = ?').run((cur?.logs || '') + line + '\n', deploymentId);
  } catch {}
}

// ─── Auto Detect ──────────────────────────────────────────────────────────
function detectProjectType(dir) {
  const has = (f) => fs.existsSync(path.join(dir, f));
  const read = (f) => { try { return fs.readFileSync(path.join(dir, f), 'utf8'); } catch { return ''; } };

  if (has('next.config.js') || has('next.config.ts') || has('next.config.mjs')) return 'nextjs';
  if (has('vite.config.js') || has('vite.config.ts')) return 'vite';
  if (has('requirements.txt') || has('setup.py') || has('pyproject.toml')) return 'python';
  if (has('Procfile')) {
    const proc = read('Procfile');
    if (proc.includes('python') || proc.includes('uvicorn') || proc.includes('gunicorn')) return 'python';
  }
  if (has('package.json')) {
    try {
      const pkg = JSON.parse(read('package.json'));
      if (pkg.dependencies?.next || pkg.devDependencies?.next) return 'nextjs';
      if (pkg.scripts?.start) return 'node';
    } catch {}
    return 'node';
  }
  if (has('index.html')) return 'static';
  return 'static';
}

// ─── Auto detect backend port dari source code ────────────────────────────
function detectBackendPort(dir) {
  const patterns = [
    /--port[=\s]+(\d+)/,
    /port[=:\s]+(\d+)/i,
    /PORT[=:\s]+(\d+)/,
    /listen\s*\(\s*(\d+)/,
    /uvicorn.*--port\s+(\d+)/,
    /run\(.*port\s*=\s*(\d+)/,
  ];

  const filesToCheck = ['backend.py', 'app.py', 'main.py', 'server.py', 'start.py', 'index.js', 'server.js', 'app.js'];

  for (const file of filesToCheck) {
    const fullPath = path.join(dir, file);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        const port = parseInt(match[1]);
        if (port > 1000 && port < 65535) return port;
      }
    }
  }
  return null;
}

// ─── Auto detect start command ────────────────────────────────────────────
function detectStartCommand(dir, port) {
  const has = (f) => fs.existsSync(path.join(dir, f));
  const read = (f) => { try { return fs.readFileSync(path.join(dir, f), 'utf8'); } catch { return ''; } };

  // Cek Procfile dulu
  if (has('Procfile')) {
    const proc = read('Procfile');
    const web = proc.split('\n').find(l => l.startsWith('web:'));
    if (web) {
      let cmd = web.replace('web:', '').trim();
      // Fix port
      cmd = cmd.replace(/\$PORT/g, port);
      cmd = cmd.replace(/--port\s+\d+/, `--port ${port}`);
      return cmd;
    }
  }

  // Cek package.json
  if (has('package.json')) {
    try {
      const pkg = JSON.parse(read('package.json'));
      if (pkg.scripts?.start) return `npm start`;
    } catch {}
  }

  // Cek Python files
  const pythonEntries = ['start.py', 'app.py', 'main.py', 'server.py', 'run.py'];
  for (const f of pythonEntries) {
    if (!has(f)) continue;
    const content = read(f);
    if (content.includes('uvicorn') || content.includes('fastapi')) {
      const moduleMatch = content.match(/uvicorn\.run\(['"]([^'"]+)['"]/);
      const module = moduleMatch ? moduleMatch[1] : `${f.replace('.py','')}:app`;
      return `python3 -m uvicorn ${module} --host 0.0.0.0 --port ${port}`;
    }
    if (content.includes('flask') || content.includes('Flask')) {
      return `python3 ${f}`;
    }
    return `python3 ${f}`;
  }

  // Cek backend.py khusus
  if (has('backend.py')) {
    const content = read('backend.py');
    if (content.includes('uvicorn') || content.includes('fastapi') || content.includes('FastAPI')) {
      return `python3 -m uvicorn backend:app --host 0.0.0.0 --port ${port}`;
    }
    return `python3 backend.py`;
  }

  return null;
}

// ─── Auto replace localhost URLs di frontend ──────────────────────────────
function replaceLocalhostUrls(dir, oldPort, newDomain) {
  const extensions = ['.html', '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte'];
  const patterns = [
    new RegExp(`http://localhost:${oldPort}`, 'g'),
    new RegExp(`http://127.0.0.1:${oldPort}`, 'g'),
    new RegExp(`localhost:${oldPort}`, 'g'),
    new RegExp(`127\\.0\\.0\\.1:${oldPort}`, 'g'),
  ];

  let count = 0;

  function processDir(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir);
    for (const entry of entries) {
      if (['node_modules', '.git', '__pycache__', '.next'].includes(entry)) continue;
      const fullPath = path.join(currentDir, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        processDir(fullPath);
      } else if (extensions.includes(path.extname(entry).toLowerCase())) {
        let content = fs.readFileSync(fullPath, 'utf8');
        let changed = false;
        for (const pattern of patterns) {
          if (pattern.test(content)) {
            content = content.replace(pattern, `https://${newDomain}`);
            changed = true;
            count++;
          }
        }
        if (changed) fs.writeFileSync(fullPath, content, 'utf8');
      }
    }
  }

  processDir(dir);
  return count;
}

// ─── Auto update Cloudflare Tunnel config ─────────────────────────────────
function updateTunnelConfig(appId, domain, port, projectType) {
  const configPath = path.join(os.homedir(), '.cloudflared', 'config.yml');
  if (!fs.existsSync(configPath)) return;

  let config = fs.readFileSync(configPath, 'utf8');

  // Cek apakah entry sudah ada
  if (config.includes(domain)) return;

  // Tambah entry baru sebelum wildcard/404
  const service = ['node', 'python', 'nextjs'].includes(projectType)
    ? `http://localhost:${port}`
    : `http://localhost:8080`;

  const newEntry = `  - hostname: ${domain}\n    service: ${service}`;

  // Insert sebelum baris "- service: http_status:404" atau wildcard
  config = config.replace(
    /(\s*- service: http_status:404)/,
    `\n${newEntry}\n$1`
  );

  fs.writeFileSync(configPath, config, 'utf8');
}

// ─── Auto restart cloudflared ─────────────────────────────────────────────
function restartCloudflared() {
  return new Promise(resolve => {
    exec('pm2 restart cloudflared 2>/dev/null || true', () => resolve());
  });
}

// ─── Run Command ──────────────────────────────────────────────────────────
function runCommand(cmd, cwd, appId, deploymentId, logLabel) {
  return new Promise((resolve, reject) => {
    emitLog(appId, `$ ${logLabel || cmd}`);
    const proc = exec(cmd, { cwd, env: { ...process.env, CI: 'false' } });
    let output = '';
    proc.stdout.on('data', d => {
      d.split('\n').forEach(line => {
        if (line.trim()) { emitLog(appId, line); output += line + '\n'; appendDeployLog(deploymentId, line); }
      });
    });
    proc.stderr.on('data', d => {
      d.split('\n').forEach(line => {
        if (line.trim()) { emitLog(appId, `  ${line}`); output += line + '\n'; appendDeployLog(deploymentId, line); }
      });
    });
    proc.on('close', code => code === 0 ? resolve(output) : reject(new Error(`"${cmd}" exit ${code}`)));
  });
}

function pm2Start(name, cwd, port, framework, startCmd) {
  return new Promise((resolve, reject) => {
    let cmd;
    if (startCmd) {
      // Custom start command (Python, dll)
      cmd = `PORT=${port} pm2 start --name "${name}" --interpreter none -- /bin/sh -c '${startCmd}'`;
    } else if (framework === 'nextjs') {
      cmd = `PORT=${port} pm2 start npm --name "${name}" -- start -- -p ${port}`;
    } else {
      cmd = `PORT=${port} pm2 start npm --name "${name}" -- start`;
    }
    exec(cmd, { cwd }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

function pm2Stop(name) {
  return new Promise(resolve => {
    exec(`pm2 stop "${name}" 2>/dev/null && pm2 delete "${name}" 2>/dev/null`, () => resolve());
  });
}

function pm2Restart(name) {
  return new Promise((resolve, reject) => {
    exec(`pm2 restart "${name}"`, (err, stdout) => err ? reject(new Error(err.message)) : resolve(stdout));
  });
}

function pm2Logs(name, lines = 100) {
  return new Promise(resolve => {
    exec(`pm2 logs "${name}" --nostream --lines ${lines}`, (err, stdout, stderr) => resolve(stdout + stderr));
  });
}

// ─── MAIN DEPLOY ──────────────────────────────────────────────────────────
async function deploy({ project, deploymentId, zipPath, cfZoneId, cfDomain, cfSubdomain }) {
  const appId  = project.app_id;
  const appDir = path.join(APPS_DIR, appId);
  const startMs = Date.now();

  const log = (msg) => {
    emitLog(appId, msg);
    appendDeployLog(deploymentId, msg);
    console.log(`[${appId}] ${msg}`);
  };

  try {
    // ── Step 1: Prepare ──────────────────────────────────────────────────
    log('📁 Menyiapkan direktori project...');
    if (fs.existsSync(appDir)) fs.rmSync(appDir, { recursive: true, force: true });
    fs.mkdirSync(appDir, { recursive: true });

    // ── Step 2: Extract / Clone ──────────────────────────────────────────
    if (zipPath) {
      log('📦 Mengekstrak ZIP...');
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(appDir, true);
      // Flatten jika ada single folder wrapper
      const entries = fs.readdirSync(appDir);
      if (entries.length === 1 && fs.statSync(path.join(appDir, entries[0])).isDirectory()) {
        const inner = path.join(appDir, entries[0]);
        fs.readdirSync(inner).forEach(f => fs.renameSync(path.join(inner, f), path.join(appDir, f)));
        fs.rmdirSync(inner);
      }
      log('✅ ZIP berhasil diekstrak.');
    } else if (project.repo_url) {
      log(`🔗 Clone: ${project.repo_url}`);
      await simpleGit().clone(project.repo_url, appDir, ['--branch', project.branch || 'main', '--depth', '1']);
      log('✅ Repository berhasil di-clone.');
    }

    // ── Step 3: Auto Detect ──────────────────────────────────────────────
    const projectType = detectProjectType(appDir);
    log(`🔍 Tipe project: ${projectType.toUpperCase()}`);
    db.prepare('UPDATE projects SET project_type = ? WHERE app_id = ?').run(projectType, appId);

    // ── Step 4: Port ─────────────────────────────────────────────────────
    let port = project.port;
    if (!port) {
      port = assignPort(appId);
      db.prepare('UPDATE projects SET port = ? WHERE app_id = ?').run(port, appId);
      log(`🔌 Port assigned: ${port}`);
    }

    // ── Step 5: Auto detect backend port & start command ─────────────────
    let backendPort = null;
    let startCmd = null;

    if (projectType === 'python') {
      backendPort = detectBackendPort(appDir);
      if (backendPort && backendPort !== port) {
        log(`🔍 Backend port terdeteksi: ${backendPort}`);
      } else {
        backendPort = port;
      }
      startCmd = detectStartCommand(appDir, backendPort);
      if (startCmd) {
        log(`🔍 Start command: ${startCmd}`);
      }
    } else if (projectType === 'node') {
      backendPort = detectBackendPort(appDir) || port;
      startCmd = detectStartCommand(appDir, backendPort);
    }

    // ── Step 6: Auto replace localhost URLs di frontend ──────────────────
    if (backendPort) {
      const apiSubdomain = `api.${cfSubdomain}.${cfDomain}`;
      log(`🔄 Mengganti localhost:${backendPort} → https://${apiSubdomain}...`);
      const count = replaceLocalhostUrls(appDir, backendPort, apiSubdomain);
      if (count > 0) {
        log(`✅ ${count} URL berhasil diganti ke ${apiSubdomain}`);
      }
    }

    // ── Step 7: Write .env ───────────────────────────────────────────────
    if (project.env_vars) {
      try {
        const envVars = JSON.parse(project.env_vars);
        const envLines = Object.entries(envVars).map(([k, v]) => `${k}=${v}`).join('\n');
        if (envLines) { fs.writeFileSync(path.join(appDir, '.env'), envLines, 'utf8'); log('⚙️ .env ditulis.'); }
      } catch {}
    }

    // ── Step 8: Install dependencies ─────────────────────────────────────
    if (['node', 'nextjs', 'vite'].includes(projectType) && fs.existsSync(path.join(appDir, 'package.json'))) {
      log('📦 npm install...');
      await runCommand('npm install --legacy-peer-deps', appDir, appId, deploymentId, 'npm install');
      log('✅ Dependencies installed.');
    }

    if (projectType === 'python' && fs.existsSync(path.join(appDir, 'requirements.txt'))) {
      log('📦 pip install -r requirements.txt...');
      await runCommand('pip3 install -r requirements.txt', appDir, appId, deploymentId, 'pip install');
      log('✅ Python dependencies installed.');
    }

    // ── Step 9: Build ────────────────────────────────────────────────────
    if (projectType === 'vite' || projectType === 'nextjs') {
      log('🔨 npm run build...');
      await runCommand(`PORT=${port} npm run build`, appDir, appId, deploymentId, 'npm run build');
      log('✅ Build selesai!');
    }

    // ── Step 10: Deploy / Start ───────────────────────────────────────────
    const pm2Name = `deployflow-${appId}`;
    const fullDomain = cfSubdomain ? `${cfSubdomain}.${cfDomain}` : cfDomain;
    const apiDomain = backendPort ? `api.${cfSubdomain}.${cfDomain}` : null;

    if (projectType === 'static') {
      const staticPath = path.join(nginx.STATIC_ROOT, appId);
      if (fs.existsSync(staticPath)) fs.rmSync(staticPath, { recursive: true });
      fs.mkdirSync(staticPath, { recursive: true });
      const distDir = ['dist', 'out', 'build', ''].find(d => fs.existsSync(path.join(appDir, d || '.', 'index.html')));
      const srcDir = distDir ? path.join(appDir, distDir) : appDir;
      execSync(`cp -r "${srcDir}/." "${staticPath}/"`);
      log(`📁 Static files → ${staticPath}`);

    } else if (projectType === 'vite') {
      const staticPath = path.join(nginx.STATIC_ROOT, appId);
      if (fs.existsSync(staticPath)) fs.rmSync(staticPath, { recursive: true });
      fs.mkdirSync(staticPath, { recursive: true });
      const distDir = path.join(appDir, 'dist');
      if (fs.existsSync(distDir)) { execSync(`cp -r "${distDir}/." "${staticPath}/"`); log(`📁 Vite dist → ${staticPath}`); }

    } else if (projectType === 'python') {
      await pm2Stop(pm2Name).catch(() => {});
      if (!startCmd) throw new Error('Tidak bisa detect start command Python. Tambah Procfile dengan format: web: python3 app.py');

      // Kalau ada frontend (index.html) dan backend, setup static dulu
      if (fs.existsSync(path.join(appDir, 'index.html'))) {
        const staticPath = path.join(nginx.STATIC_ROOT, appId);
        if (fs.existsSync(staticPath)) fs.rmSync(staticPath, { recursive: true });
        fs.mkdirSync(staticPath, { recursive: true });
        execSync(`cp -r "${appDir}/." "${staticPath}/"`);
        log(`📁 Frontend static → ${staticPath}`);
      }

      // Install uvicorn/gunicorn kalau perlu
      if (startCmd.includes('uvicorn')) {
        await runCommand('pip3 install uvicorn', appDir, appId, deploymentId, 'pip install uvicorn').catch(() => {});
      }
      if (startCmd.includes('gunicorn')) {
        await runCommand('pip3 install gunicorn', appDir, appId, deploymentId, 'pip install gunicorn').catch(() => {});
      }

      log(`🚀 Menjalankan Python via PM2: ${startCmd}`);
      const pm2ApiName = `deployflow-api-${appId}`;
      await pm2Stop(pm2ApiName).catch(() => {});
      await new Promise((resolve, reject) => {
        exec(`pm2 start --name "${pm2ApiName}" /bin/bash -- -c "${startCmd}"`, { cwd: appDir }, (err, stdout) => {
          if (err) reject(new Error(err.message)); else resolve(stdout);
        });
      });
      db.prepare('UPDATE projects SET pm2_name = ? WHERE app_id = ?').run(pm2ApiName, appId);
      log(`✅ Python backend jalan! (port ${backendPort})`);

      // Auto update tunnel untuk API domain
      if (apiDomain && cfZoneId) {
        log(`☁️  Setup API domain: ${apiDomain}...`);
        updateTunnelConfig(appId, apiDomain, backendPort, 'python');
        await restartCloudflared();

        try {
          await cf.createDnsRecord({ zoneId: cfZoneId, subdomain: `api.${cfSubdomain}`, domain: cfDomain });
          log(`✅ DNS api.${cfSubdomain}.${cfDomain} dibuat!`);
        } catch (e) {
          log(`⚠️ DNS API: ${e.message}`);
        }
      }

    } else {
      // Node / Next.js
      await pm2Stop(pm2Name).catch(() => {});
      log(`🚀 Menjalankan dengan PM2 (port ${port})...`);
      await pm2Start(pm2Name, appDir, port, projectType, null);
      db.prepare('UPDATE projects SET pm2_name = ? WHERE app_id = ?').run(pm2Name, appId);
      log(`✅ App berjalan di port ${port}!`);
    }

    // ── Step 11: Nginx ────────────────────────────────────────────────────
    log(`🌐 Setup Nginx untuk ${fullDomain}...`);
    const staticPath = ['vite', 'static', 'python'].includes(projectType) ? path.join(nginx.STATIC_ROOT, appId) : null;
    const { filename: nginxFile } = nginx.writeConfig({
      appId, domain: fullDomain, port,
      projectType: (staticPath && fs.existsSync(staticPath)) ? 'static' : 'node',
      staticPath,
    });
    db.prepare('UPDATE projects SET nginx_file = ?, domain = ?, subdomain = ? WHERE app_id = ?').run(nginxFile, fullDomain, cfSubdomain, appId);

    // Nginx untuk API domain (Python backend)
    if (apiDomain && backendPort) {
      nginx.writeConfig({ appId: `${appId}-api`, domain: apiDomain, port: backendPort, projectType: 'node', staticPath: null });
      log(`✅ Nginx API config → ${apiDomain}`);
    }

    const nginxTest = nginx.testConfig();
    if (nginxTest.ok) {
      log('✅ Nginx config valid.');
      await nginx.reloadNginx();
      log('🔄 Nginx reloaded.');
    } else {
      log(`⚠️ Nginx: ${nginxTest.error}`);
    }

    // ── Step 12: Cloudflare DNS ───────────────────────────────────────────
    if (cfZoneId && cfDomain) {
      try {
        log(`☁️  DNS: ${fullDomain} → Cloudflare Tunnel...`);
        const record = await cf.createDnsRecord({ zoneId: cfZoneId, subdomain: cfSubdomain, domain: cfDomain });
        db.prepare('UPDATE projects SET cf_record_id = ? WHERE app_id = ?').run(record.id, appId);
        log(`✅ DNS dibuat! (ID: ${record.id})`);

        // Update tunnel config
        updateTunnelConfig(appId, fullDomain, port, projectType);
        await restartCloudflared();
        log(`🔄 Tunnel config updated.`);
      } catch (e) {
        log(`⚠️ Cloudflare: ${e.message}`);
      }
    }

    // ── Finalize ─────────────────────────────────────────────────────────
    const duration = Math.round((Date.now() - startMs) / 1000);
    db.prepare("UPDATE deployments SET status = 'ready', duration = ? WHERE id = ?").run(duration, deploymentId);
    db.prepare("UPDATE projects SET status = 'ready', updated_at = datetime('now') WHERE app_id = ?").run(appId);
    emitStatus(appId, 'ready');

    if (apiDomain) {
      log(`\n🎉 Deploy selesai dalam ${duration} detik!`);
      log(`   Frontend : https://${fullDomain}`);
      log(`   Backend  : https://${apiDomain}`);
    } else {
      log(`\n🎉 Deploy selesai dalam ${duration} detik!`);
      log(`   URL: https://${fullDomain}`);
    }

    return { success: true, domain: fullDomain, apiDomain, port, projectType, duration };

  } catch (err) {
    const errMsg = err.message || String(err);
    log(`\n❌ DEPLOY GAGAL: ${errMsg}`);
    db.prepare("UPDATE deployments SET status = 'error', logs = logs || ? WHERE id = ?").run('\n❌ ' + errMsg, deploymentId);
    db.prepare("UPDATE projects SET status = 'error', updated_at = datetime('now') WHERE app_id = ?").run(appId);
    emitStatus(appId, 'error');
    throw err;
  }
}

// ─── REDEPLOY ─────────────────────────────────────────────────────────────
async function redeploy(project) {
  const appId  = project.app_id;
  const appDir = path.join(APPS_DIR, appId);
  const log = (msg) => emitLog(appId, msg);

  const depResult = db.prepare("INSERT INTO deployments (project_id, status, commit_message) VALUES (?, 'building', 'Redeployment')").run(project.id);
  const deploymentId = depResult.lastInsertRowid;
  db.prepare("UPDATE projects SET status = 'building' WHERE app_id = ?").run(appId);
  emitStatus(appId, 'building');

  try {
    if (project.repo_url && fs.existsSync(path.join(appDir, '.git'))) {
      log('🔄 git pull...');
      await simpleGit(appDir).pull('origin', project.branch || 'main');
    }

    const projectType = project.project_type || detectProjectType(appDir);

    if (['node','nextjs','vite'].includes(projectType) && fs.existsSync(path.join(appDir, 'package.json'))) {
      log('📦 npm install...'); await runCommand('npm install --legacy-peer-deps', appDir, appId, deploymentId, 'npm install');
    }
    if (projectType === 'python' && fs.existsSync(path.join(appDir, 'requirements.txt'))) {
      log('📦 pip install...'); await runCommand('pip3 install -r requirements.txt', appDir, appId, deploymentId, 'pip install');
    }
    if (projectType === 'vite' || projectType === 'nextjs') {
      log('🔨 npm run build...'); await runCommand(`PORT=${project.port} npm run build`, appDir, appId, deploymentId, 'npm run build');
    }

    if (project.pm2_name) { log(`🔄 pm2 restart...`); await pm2Restart(project.pm2_name); }

    if (['vite','static'].includes(projectType)) {
      const staticPath = path.join(nginx.STATIC_ROOT, appId);
      const distDir = path.join(appDir, 'dist');
      if (fs.existsSync(distDir)) { execSync(`cp -r "${distDir}/." "${staticPath}/"`); log('✅ Static updated.'); }
    }

    db.prepare("UPDATE deployments SET status = 'ready' WHERE id = ?").run(deploymentId);
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

// ─── DELETE ───────────────────────────────────────────────────────────────
async function deleteProject(project) {
  const appId  = project.app_id;
  const appDir = path.join(APPS_DIR, appId);

  if (project.pm2_name) await pm2Stop(project.pm2_name).catch(() => {});
  // Stop API pm2 juga
  await pm2Stop(`deployflow-api-${appId}`).catch(() => {});

  // Hapus nginx config lama
  if (project.nginx_file) {
    nginx.removeConfig(project.nginx_file);
    nginx.removeConfig(`${project.nginx_file}-api`);
  }

  // Buat halaman "Website Telah Dihapus" untuk domain yang dihapus
  // DNS TIDAK dihapus dulu, biarkan halaman deleted muncul 10 hari
  if (project.domain) {
    try {
      nginx.writeDeletedConfig(project.domain);
      // Simpan jadwal hapus DNS ke file
      const schedPath = '/root/panel/backend/database/pending_dns_delete.json';
      const fs2 = require('fs');
      let pending = [];
      try { pending = JSON.parse(fs2.readFileSync(schedPath, 'utf8')); } catch {}
      pending.push({
        domain:     project.domain,
        cf_record_id: project.cf_record_id,
        delete_at:  Date.now() + (10 * 24 * 60 * 60 * 1000), // 10 hari
        nginx_deleted_config: `deployflow-deleted-${project.domain.replace(/\./g, '-')}`,
      });
      fs2.writeFileSync(schedPath, JSON.stringify(pending, null, 2));
      console.log(`[DELETE] Halaman deleted aktif untuk ${project.domain}, DNS akan dihapus dalam 10 hari`);
    } catch (e) {
      console.log(`[DELETE] Warning: ${e.message}`);
    }
  }

  await nginx.reloadNginx().catch(() => {});

  // DNS tidak langsung dihapus - dijadwalkan 10 hari via cron
  // (lihat pending_dns_delete.json)

  if (project.port) releasePort(project.port);
  if (fs.existsSync(appDir)) fs.rmSync(appDir, { recursive: true, force: true });
  const staticPath = path.join(nginx.STATIC_ROOT, appId);
  if (fs.existsSync(staticPath)) fs.rmSync(staticPath, { recursive: true, force: true });
}

async function getLogs(project, lines = 100) {
  if (project.pm2_name) return pm2Logs(project.pm2_name, lines);
  return 'App ini static, tidak ada runtime logs.\n';
}

module.exports = { deploy, redeploy, deleteProject, getLogs, setWss, pm2Stop, pm2Logs };
