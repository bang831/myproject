#!/bin/bash
# ============================================================
# setup.sh - DeployFlow Full Setup Script
# Jalankan di Ubuntu proot dalam Termux
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════╗"
echo "║   🚀 DeployFlow Setup Script                 ║"
echo "║   Mini Railway / Mini Vercel di Android      ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# ── 1. Update system ─────────────────────────────────────────
echo -e "${YELLOW}[1/8] Update system packages...${NC}"
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Install dependencies ───────────────────────────────────
echo -e "${YELLOW}[2/8] Install dependencies (Node.js, Nginx, Git)...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null
apt-get install -y nodejs nginx git curl unzip 2>/dev/null

# ── 3. Install PM2 global ────────────────────────────────────
echo -e "${YELLOW}[3/8] Install PM2...${NC}"
npm install -g pm2 --silent
pm2 startup 2>/dev/null || true

# ── 4. Setup directories ─────────────────────────────────────
echo -e "${YELLOW}[4/8] Setup directories...${NC}"
mkdir -p /root/apps
mkdir -p /var/www
mkdir -p /etc/nginx/sites-enabled
mkdir -p /etc/nginx/sites-available

# Default nginx config
cat > /etc/nginx/nginx.conf << 'EOF'
user www-data;
worker_processes auto;
pid /run/nginx.pid;

events {
    worker_connections 768;
}

http {
    sendfile on;
    tcp_nopush on;
    types_hash_max_size 2048;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    gzip on;

    include /etc/nginx/sites-enabled/*;
}
EOF

# ── 5. Install backend dependencies ──────────────────────────
echo -e "${YELLOW}[5/8] Install backend dependencies...${NC}"
cd /root/panel/backend
npm install --silent

# ── 6. Setup .env ────────────────────────────────────────────
echo -e "${YELLOW}[6/8] Setup environment...${NC}"
if [ ! -f .env ]; then
    cp .env.example .env
    # Generate JWT secret otomatis
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
    sed -i "s/ganti-ini-dengan-secret-yang-sangat-panjang-dan-acak/$JWT_SECRET/" .env
    echo -e "${GREEN}✅ .env berhasil dibuat dengan JWT secret acak${NC}"
fi

# ── 7. Build frontend ────────────────────────────────────────
echo -e "${YELLOW}[7/8] Build frontend...${NC}"
cd /root/panel/frontend

# Remove supabase dari dependencies jika ada
npm install --silent 2>/dev/null || true
npm run build --silent 2>/dev/null && echo -e "${GREEN}✅ Frontend berhasil di-build${NC}" || echo -e "${YELLOW}⚠️ Build frontend manual: cd frontend && npm run build${NC}"

# ── 8. Setup Termux:Boot ────────────────────────────────────
echo -e "${YELLOW}[8/8] Setup auto-start...${NC}"

# Buat script startup
cat > /root/start-deployflow.sh << 'STARTSCRIPT'
#!/bin/bash
# DeployFlow Auto-Start Script
cd /root/panel/backend

# Start cloudflared tunnel (kalau sudah dikonfigurasi)
if command -v cloudflared &> /dev/null; then
    cloudflared tunnel run &
    echo "cloudflared started"
fi

# Start nginx
service nginx start 2>/dev/null || nginx 2>/dev/null || true
echo "nginx started"

# Restore semua PM2 apps yang sebelumnya jalan
pm2 resurrect 2>/dev/null || true

# Start backend panel
pm2 start node --name "deployflow-panel" -- server.js
pm2 save

echo "DeployFlow started!"
STARTSCRIPT

chmod +x /root/start-deployflow.sh

# Termux:Boot directory
TERMUX_BOOT_DIR="$HOME/../usr/var/service/boot"
if [ -d "$TERMUX_BOOT_DIR" ]; then
    cp /root/start-deployflow.sh "$TERMUX_BOOT_DIR/"
    echo -e "${GREEN}✅ Auto-start via Termux:Boot dikonfigurasi${NC}"
fi

# ── Done ─────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║   ✅ Setup Selesai!                              ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║                                                  ║"
echo "║   Jalankan panel:                                ║"
echo "║   $ bash /root/start-deployflow.sh              ║"
echo "║                                                  ║"
echo "║   Atau manual:                                   ║"
echo "║   $ cd /root/panel/backend && node server.js    ║"
echo "║                                                  ║"
echo "║   Panel URL: http://localhost:4000               ║"
echo "║                                                  ║"
echo "║   JANGAN LUPA:                                   ║"
echo "║   1. Edit backend/.env sesuai kebutuhan         ║"
echo "║   2. Setup Cloudflare token di Settings panel    ║"
echo "║   3. Setup cloudflared tunnel                   ║"
echo "║                                                  ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"
