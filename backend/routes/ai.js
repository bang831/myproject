const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { db } = require('../db');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { exec } = require('child_process');

const router = express.Router();
router.use(authMiddleware);

const APPS_DIR   = process.env.APPS_DIR   || path.join(os.homedir(), 'apps');
const NGINX_DIR  = process.env.NGINX_DIR  || '/etc/nginx/sites-enabled';
const GROQ_API   = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL      = 'llama-3.3-70b-versatile';

function getApiKeys() {
  const k1 = db.prepare("SELECT value FROM settings WHERE key = 'groq_key_1'").get()?.value;
  const k2 = db.prepare("SELECT value FROM settings WHERE key = 'groq_key_2'").get()?.value;
  return [k1, k2].filter(Boolean);
}

async function callGroq(messages, keys, idx = 0) {
  if (idx >= keys.length) throw new Error('Semua API key gagal atau limit.');
  try {
    const res = await fetch(GROQ_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${keys[idx]}` },
      body: JSON.stringify({ model: MODEL, messages, max_tokens: 4096, temperature: 0.7 }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 429 || res.status === 401) {
        console.log(`[AI] Key ${idx+1} gagal (${res.status}), coba key ${idx+2}...`);
        return callGroq(messages, keys, idx + 1);
      }
      throw new Error(err.error?.message || `Groq error ${res.status}`);
    }
    const data = await res.json();
    return { content: data.choices[0].message.content, keyUsed: idx + 1, tokens: data.usage?.total_tokens };
  } catch (err) {
    if (err.message.includes('Semua API')) throw err;
    return callGroq(messages, keys, idx + 1);
  }
}

// ─── Kumpulkan SEMUA konteks project ─────────────────────────────────────
async function gatherFullContext(appId, userId) {
  const project = db.prepare('SELECT * FROM projects WHERE app_id = ? AND user_id = ?').get(appId, userId);
  if (!project) return null;

  const appDir = path.join(APPS_DIR, appId);

  // 1. Struktur file lengkap
  let fileTree = '';
  function scanDir(dir, prefix = '', depth = 0) {
    if (depth > 4 || !fs.existsSync(dir)) return;
    try {
      fs.readdirSync(dir).forEach(f => {
        if (['node_modules','.git','__pycache__','.next','dist','build'].includes(f)) return;
        const full = path.join(dir, f);
        const stat = fs.statSync(full);
        fileTree += `${prefix}${stat.isDirectory() ? '📁' : '📄'} ${f}\n`;
        if (stat.isDirectory()) scanDir(full, prefix + '  ', depth + 1);
      });
    } catch {}
  }
  scanDir(appDir);

  // 2. Isi file penting (package.json, requirements.txt, .env, Procfile, main entry)
  const importantFiles = ['package.json','requirements.txt','.env','Procfile','server.js','app.py','main.py','backend.py','index.js','next.config.js','vite.config.js'];
  let fileContents = '';
  for (const fname of importantFiles) {
    const fpath = path.join(appDir, fname);
    if (fs.existsSync(fpath)) {
      try {
        const content = fs.readFileSync(fpath, 'utf8').slice(0, 2000);
        fileContents += `\n--- ${fname} ---\n${content}\n`;
      } catch {}
    }
  }

  // 3. Logs terbaru
  const deployments = db.prepare('SELECT * FROM deployments WHERE project_id = ? ORDER BY id DESC LIMIT 3').all(project.id);
  const lastLogs = deployments[0]?.logs?.slice(-3000) || 'Tidak ada log deploy';

  // 4. PM2 logs
  const pm2Logs = await new Promise(resolve => {
    if (!project.pm2_name) return resolve('Tidak ada PM2 process');
    exec(`pm2 logs "${project.pm2_name}" --nostream --lines 50 2>/dev/null`, (err, stdout, stderr) => {
      resolve((stdout + stderr).slice(-2000) || 'Tidak ada PM2 logs');
    });
  });

  // 5. Nginx config
  let nginxConfig = '';
  if (project.nginx_file) {
    const nginxPath = path.join(NGINX_DIR, project.nginx_file);
    if (fs.existsSync(nginxPath)) {
      nginxConfig = fs.readFileSync(nginxPath, 'utf8');
    }
  }

  // 6. Cek apakah port responding
  const portStatus = await new Promise(resolve => {
    if (!project.port) return resolve('Port tidak diset');
    exec(`curl -s -o /dev/null -w "%{http_code}" http://localhost:${project.port} --max-time 3 2>/dev/null`, (err, stdout) => {
      resolve(stdout ? `HTTP ${stdout}` : 'Tidak merespon');
    });
  });

  return {
    project,
    fileTree,
    fileContents,
    lastLogs,
    pm2Logs,
    nginxConfig,
    portStatus,
    deployments,
  };
}

// POST /api/ai/analyze/:appId - Analisis lengkap
router.post('/analyze/:appId', async (req, res) => {
  try {
    const keys = getApiKeys();
    if (!keys.length) return res.status(400).json({ error: 'Groq API key belum dikonfigurasi.' });

    const ctx = await gatherFullContext(req.params.appId, req.user.id);
    if (!ctx) return res.status(404).json({ error: 'Project tidak ditemukan.' });

    const { project, fileTree, fileContents, lastLogs, pm2Logs, nginxConfig, portStatus } = ctx;

    const messages = [
      {
        role: 'system',
        content: `Kamu adalah AI assistant expert untuk platform deploy DeployFlow yang berjalan di Android (Termux + Ubuntu proot + Nginx + PM2 + Cloudflare Tunnel).
Kamu memiliki akses penuh ke semua file, log, dan konfigurasi project.
Tugasmu: analisis masalah secara mendalam dan berikan solusi yang SPESIFIK dan LANGSUNG BISA DIJALANKAN dalam Bahasa Indonesia.
Format respons dengan emoji dan struktur yang jelas.`,
      },
      {
        role: 'user',
        content: `Analisis project ini secara menyeluruh:

═══════════════════════════════════
📋 INFO PROJECT
═══════════════════════════════════
Nama: ${project.name}
App ID: ${project.app_id}
Framework: ${project.framework}
Project Type: ${project.project_type}
Status: ${project.status}
Domain: ${project.domain}
Port: ${project.port}
PM2 Name: ${project.pm2_name || 'Tidak ada'}
Port Status: ${portStatus}

═══════════════════════════════════
📁 STRUKTUR FILE
═══════════════════════════════════
${fileTree || 'Folder kosong atau tidak ditemukan'}

═══════════════════════════════════
📄 ISI FILE PENTING
═══════════════════════════════════
${fileContents || 'Tidak ada file penting'}

═══════════════════════════════════
🔧 NGINX CONFIG
═══════════════════════════════════
${nginxConfig || 'Tidak ada nginx config'}

═══════════════════════════════════
📊 DEPLOY LOG TERAKHIR
═══════════════════════════════════
${lastLogs}

═══════════════════════════════════
⚡ PM2 RUNTIME LOGS
═══════════════════════════════════
${pm2Logs}

Berikan analisis lengkap:
1. 🔍 **Status & Kondisi** — apakah website berjalan normal?
2. ❌ **Masalah yang Ditemukan** — list semua masalah
3. 🔧 **Solusi Step-by-Step** — langkah konkret untuk tiap masalah
4. 💻 **Command yang Perlu Dijalankan** — command siap pakai
5. 💡 **Rekomendasi** — saran untuk mencegah masalah di masa depan`,
      },
    ];

    const result = await callGroq(messages, keys);
    res.json({ analysis: result.content, keyUsed: result.keyUsed, tokens: result.tokens });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/chat - Chat dengan konteks penuh
router.post('/chat', async (req, res) => {
  try {
    const keys = getApiKeys();
    if (!keys.length) return res.status(400).json({ error: 'Groq API key belum dikonfigurasi.' });

    const { message, appId, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'Message kosong.' });

    let systemPrompt = `Kamu adalah AI assistant expert untuk DeployFlow — platform deploy website yang berjalan di Android (Termux + Ubuntu proot + Nginx + PM2 + Cloudflare Tunnel).
Kamu bisa membantu: debug masalah deploy, edit konfigurasi, analisis error, dan memberikan solusi teknis.
Selalu jawab dalam Bahasa Indonesia dengan format yang jelas dan solusi yang langsung bisa dijalankan.`;

    // Kalau ada appId, ambil konteks lengkap
    if (appId) {
      const ctx = await gatherFullContext(appId, req.user.id);
      if (ctx) {
        const { project, fileTree, lastLogs, pm2Logs, portStatus } = ctx;
        systemPrompt += `

KONTEKS PROJECT AKTIF:
- Nama: ${project.name} (${project.app_id})
- Framework: ${project.framework} | Type: ${project.project_type}
- Status: ${project.status} | Port: ${project.port} (${portStatus})
- Domain: ${project.domain}
- PM2: ${project.pm2_name || 'Tidak ada'}

STRUKTUR FILE:
${fileTree.slice(0, 1000)}

LOG TERAKHIR:
${lastLogs.slice(0, 1000)}

PM2 LOGS:
${pm2Logs.slice(0, 500)}`;
      }
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10),
      { role: 'user', content: message },
    ];

    const result = await callGroq(messages, keys);
    res.json({ reply: result.content, keyUsed: result.keyUsed, tokens: result.tokens });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/read-file - AI baca file spesifik
router.post('/read-file', async (req, res) => {
  try {
    const keys = getApiKeys();
    if (!keys.length) return res.status(400).json({ error: 'Groq API key belum dikonfigurasi.' });

    const { appId, filePath, question } = req.body;
    const project = db.prepare('SELECT * FROM projects WHERE app_id = ? AND user_id = ?').get(appId, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan.' });

    const fullPath = path.resolve(path.join(APPS_DIR, appId, filePath));
    if (!fullPath.startsWith(path.join(APPS_DIR, appId))) return res.status(400).json({ error: 'Path tidak aman.' });
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File tidak ditemukan.' });

    const content = fs.readFileSync(fullPath, 'utf8').slice(0, 5000);

    const messages = [
      { role: 'system', content: 'Kamu adalah expert programmer. Analisis kode yang diberikan dan jawab pertanyaan user dalam Bahasa Indonesia.' },
      { role: 'user', content: `File: ${filePath}\n\nKode:\n\`\`\`\n${content}\n\`\`\`\n\nPertanyaan: ${question || 'Apakah ada masalah atau bug dalam kode ini?'}` },
    ];

    const result = await callGroq(messages, keys);
    res.json({ reply: result.content, keyUsed: result.keyUsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/fix-file - AI perbaiki file
router.post('/fix-file', async (req, res) => {
  try {
    const keys = getApiKeys();
    if (!keys.length) return res.status(400).json({ error: 'Groq API key belum dikonfigurasi.' });

    const { appId, filePath, content, problem } = req.body;
    const messages = [
      { role: 'system', content: 'Kamu adalah expert programmer. Perbaiki kode yang diberikan. Kembalikan HANYA kode yang sudah diperbaiki tanpa penjelasan.' },
      { role: 'user', content: `File: ${filePath}\nMasalah: ${problem || 'Perbaiki bug/error'}\n\nKode:\n\`\`\`\n${content}\n\`\`\`` },
    ];

    const result = await callGroq(messages, keys);
    let fixed = result.content.replace(/^```[\w]*\n?/m, '').replace(/\n?```$/m, '').trim();
    res.json({ fixedContent: fixed, keyUsed: result.keyUsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/settings - Simpan keys
router.post('/settings', (req, res) => {
  try {
    const { key1, key2 } = req.body;
    if (key1) db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('groq_key_1', key1);
    if (key2) db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('groq_key_2', key2);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal simpan.' });
  }
});

// GET /api/ai/status
router.get('/status', (req, res) => {
  const k1 = !!db.prepare("SELECT value FROM settings WHERE key = 'groq_key_1'").get()?.value;
  const k2 = !!db.prepare("SELECT value FROM settings WHERE key = 'groq_key_2'").get()?.value;
  res.json({ key1: k1, key2: k2, configured: k1 || k2 });
});

module.exports = router;
