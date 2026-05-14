
// lib/nginx.js - Nginx Config Manager

const fs   = require('fs');

const path = require('path');

const { execSync, exec } = require('child_process');



const NGINX_DIR   = process.env.NGINX_DIR   || '/etc/nginx/sites-enabled';

const STATIC_ROOT = process.env.STATIC_ROOT || '/var/www';



function generateConfig({ appId, domain, port, projectType, staticPath, indexFile }) {

  const idx = indexFile || 'index.html';



  if (projectType === 'static') {

    return `

# DeployFlow - ${appId}

server {

    listen 8080;

    server_name ${domain};



    root ${staticPath};

    index ${idx};



    location / {

        try_files $uri $uri/ /${idx};

    }



    gzip on;

    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    add_header X-Frame-Options "SAMEORIGIN";

    add_header X-Content-Type-Options "nosniff";

}

`.trim();

  }



  return `

# DeployFlow - ${appId}

server {

    listen 8080;

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



    gzip on;

    gzip_types text/plain text/css application/json application/javascript;

}

`.trim();

}



function writeConfig({ appId, domain, port, projectType, staticPath, indexFile }) {

  const config   = generateConfig({ appId, domain, port, projectType, staticPath, indexFile });

  const filename = `deployflow-${appId}`;

  const filepath = path.join(NGINX_DIR, filename);



  if (!fs.existsSync(NGINX_DIR)) fs.mkdirSync(NGINX_DIR, { recursive: true });

  fs.writeFileSync(filepath, config, 'utf8');

  return { filename, filepath };

}



function testConfig() {

  try {

    execSync('nginx -t 2>&1', { encoding: 'utf8' });

    return { ok: true };

  } catch (err) {

    return { ok: false, error: err.stdout || err.message };

  }

}



function reloadNginx() {

  return new Promise((resolve, reject) => {

    exec('nginx -s reload', (err, stdout, stderr) => {

      if (err) reject(new Error(stderr || err.message));

      else resolve(stdout);

    });

  });

}



function removeConfig(filename) {

  const filepath = path.join(NGINX_DIR, filename);

  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);

}



// List semua file HTML di folder static project

function listHtmlFiles(appId) {

  const dir = path.join(STATIC_ROOT, appId);

  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)

    .filter(f => f.endsWith('.html') || f.endsWith('.htm'))

    .sort();

}



module.exports = { generateConfig, writeConfig, testConfig, reloadNginx, removeConfig, listHtmlFiles, NGINX_DIR, STATIC_ROOT };


/**
 * Buat nginx config untuk domain yang sudah dihapus
 * Arahkan ke halaman "Website Telah Dihapus"
 */
function writeDeletedConfig(domain) {
  const config = `
# DeployFlow - DELETED - ${domain}
server {
    listen 8080;
    server_name ${domain};

    root /var/www/_deleted;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
`.trim();

  const filename = `deployflow-deleted-${domain.replace(/\./g, '-')}`;
  const filepath = path.join(NGINX_DIR, filename);
  fs.writeFileSync(filepath, config, 'utf8');
  return filename;
}

module.exports.writeDeletedConfig = writeDeletedConfig;
