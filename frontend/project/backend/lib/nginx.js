// lib/nginx.js - Nginx Config Manager
const fs   = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');

const NGINX_DIR   = process.env.NGINX_DIR   || '/etc/nginx/sites-enabled';
const STATIC_ROOT = process.env.STATIC_ROOT || '/var/www';

/**
 * Generate nginx config untuk satu app
 */
function generateConfig({ appId, domain, port, projectType, staticPath }) {
  if (projectType === 'static') {
    return `
# DeployFlow - ${appId}
server {
    listen 80;
    server_name ${domain};

    root ${staticPath};
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";
}
`.trim();
  }

  // Node/Next/Vite build - proxy ke port
  return `
# DeployFlow - ${appId}
server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass         http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
`.trim();
}

/**
 * Tulis config file ke disk
 */
function writeConfig({ appId, domain, port, projectType, staticPath }) {
  const config   = generateConfig({ appId, domain, port, projectType, staticPath });
  const filename = `deployflow-${appId}`;
  const filepath = path.join(NGINX_DIR, filename);

  if (!fs.existsSync(NGINX_DIR)) {
    // Kalau di dev/testing, buat direktori lokal
    fs.mkdirSync(NGINX_DIR, { recursive: true });
  }

  fs.writeFileSync(filepath, config, 'utf8');
  return { filename, filepath };
}

/**
 * Test nginx config validity
 */
function testConfig() {
  try {
    execSync('nginx -t 2>&1', { encoding: 'utf8' });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.stdout || err.message };
  }
}

/**
 * Reload nginx
 */
function reloadNginx() {
  return new Promise((resolve, reject) => {
    exec('service nginx reload || nginx -s reload', (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

/**
 * Hapus config file
 */
function removeConfig(filename) {
  const filepath = path.join(NGINX_DIR, filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
}

module.exports = { generateConfig, writeConfig, testConfig, reloadNginx, removeConfig, NGINX_DIR, STATIC_ROOT };
