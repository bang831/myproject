#!/bin/bash
# ============================================================
# DEPLOYFLOW - AUTO SETUP SCRIPT
# Jalankan ini DI TERMUX (bukan di Ubuntu)
# Satu script, beres semua.
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${CYAN}[•] $1${NC}"; }
ok()   { echo -e "${GREEN}[✓] $1${NC}"; }
warn() { echo -e "${YELLOW}[!] $1${NC}"; }
err()  { echo -e "${RED}[✗] $1${NC}"; exit 1; }
head() { echo -e "\n${BOLD}${CYAN}━━━ $1 ━━━${NC}"; }

clear
echo -e "${CYAN}${BOLD}"
cat << 'BANNER'
  ____             _           _____ _
 |  _ \  ___ _ __ | | ___  _  |  ___| | _____      __
 | | | |/ _ \ '_ \| |/ _ \| | | |_  | |/ _ \ \ /\ / /
 | |_| |  __/ |_) | | (_) | |_|  _| | | (_) \ V  V /
 |____/ \___| .__/|_|\___/ \__|_|   |_|\___/ \_/\_/
            |_|
 Mini Railway / Mini Vercel di Android 😄
BANNER
echo -e "${NC}"
echo -e "Script ini akan setup SEMUANYA otomatis."
echo -e "Estimasi waktu: ${YELLOW}5-15 menit${NC} (tergantung kecepatan internet)\n"
read -p "Tekan ENTER untuk mulai, atau Ctrl+C untuk batal..."

# ── Cek apakah di Termux ─────────────────────────────────────
if [ -z "$TERMUX_VERSION" ] && [ ! -d "/data/data/com.termux" ]; then
  warn "Sepertinya bukan di Termux. Lanjut anyway..."
fi

# ============================================================
# STEP 1 - Setup Termux
# ============================================================
head "STEP 1/7 — Setup Termux"

log "Update Termux packages..."
pkg update -y -o Dpkg::Options::="--force-confdef" 2>/dev/null | tail -3
pkg upgrade -y -o Dpkg::Options::="--force-confdef" 2>/dev/null | tail -3
ok "Termux updated"

log "Install proot-distro, wget, unzip..."
pkg install -y proot-distro wget unzip 2>/dev/null | tail -3
ok "Dependencies installed"

# ============================================================
# STEP 2 - Install Ubuntu
# ============================================================
head "STEP 2/7 — Install Ubuntu (proot)"

if proot-distro list 2>/dev/null | grep -q "ubuntu.*installed"; then
  ok "Ubuntu sudah terinstall, skip."
else
  log "Download dan install Ubuntu... (ini yang paling lama ~200MB)"
  proot-distro install ubuntu 2>&1 | tail -5
  ok "Ubuntu terinstall!"
fi

# ============================================================
# STEP 3 - Download Panel Files
# ============================================================
head "STEP 3/7 — Download DeployFlow Panel"

log "Cek apakah file panel sudah ada..."

PANEL_ZIP="$HOME/deployflow-panel.zip"

if [ ! -f "$PANEL_ZIP" ]; then
  # Cek di folder Download HP
  if [ -f "/sdcard/Download/deployflow-panel.zip" ]; then
    log "Ketemu di /sdcard/Download/, copy..."
    cp /sdcard/Download/deployflow-panel.zip "$PANEL_ZIP"
    ok "File di-copy dari Download folder"
  else
    echo ""
    warn "File deployflow-panel.zip tidak ditemukan!"
    echo -e "Taruh file ZIP di salah satu lokasi ini:"
    echo -e "  ${YELLOW}1. $HOME/deployflow-panel.zip${NC}"
    echo -e "  ${YELLOW}2. /sdcard/Download/deployflow-panel.zip${NC}"
    echo ""
    read -p "Sudah ditaruh? Tekan ENTER untuk coba lagi, atau Ctrl+C untuk batal..."

    if [ -f "/sdcard/Download/deployflow-panel.zip" ]; then
      cp /sdcard/Download/deployflow-panel.zip "$PANEL_ZIP"
      ok "File ditemukan!"
    elif [ ! -f "$PANEL_ZIP" ]; then
      err "File tetap tidak ditemukan. Taruh ZIP-nya dulu lalu jalankan script ini lagi."
    fi
  fi
else
  ok "File panel sudah ada di $PANEL_ZIP"
fi

# ============================================================
# STEP 4 - Install Semua di Dalam Ubuntu
# ============================================================
head "STEP 4/7 — Install Node.js, Nginx, PM2 di Ubuntu"

log "Copy ZIP ke dalam Ubuntu..."
# Ubuntu proot rootfs ada di sini
UBUNTU_ROOT="$PREFIX/var/lib/proot-distro/installed-rootfs/ubuntu"
mkdir -p "$UBUNTU_ROOT/root/panel-setup"
cp "$PANEL_ZIP" "$UBUNTU_ROOT/root/panel-setup/"

log "Jalankan installer di dalam Ubuntu..."
cat > "$UBUNTU_ROOT/root/panel-setup/install.sh" << 'UBUNTU_INSTALL'
#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[•] $1${NC}"; }
ok()   { echo -e "${GREEN}[✓] $1${NC}"; }
warn() { echo -e "${YELLOW}[!] $1${NC}"; }

export DEBIAN_FRONTEND=noninteractive

# Update
log "apt update..."
apt-get update -qq 2>/dev/null

# Install packages
log "Install nginx, git, curl, unzip..."
apt-get install -y -qq nginx git curl unzip 2>/dev/null
ok "nginx, git, unzip installed"

# Node.js 20
log "Install Node.js 20..."
if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null
  apt-get install -y -qq nodejs 2>/dev/null
fi
ok "Node.js $(node -v) installed"

# PM2
log "Install PM2..."
npm install -g pm2 --silent 2>/dev/null
ok "PM2 $(pm2 -v) installed"

# cloudflared ARM64
log "Install cloudflared..."
if ! command -v cloudflared &>/dev/null; then
  curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 \
    -o /usr/local/bin/cloudflared 2>/dev/null
  chmod +x /usr/local/bin/cloudflared
fi
ok "cloudflared $(cloudflared --version 2>&1 | head -1) installed"

# Buat direktori
log "Setup folders..."
mkdir -p /root/apps
mkdir -p /var/www
mkdir -p /etc/nginx/sites-enabled
mkdir -p /root/.cloudflared

# Nginx config
cat > /etc/nginx/nginx.conf << 'NGINXCONF'
user www-data;
worker_processes auto;
pid /run/nginx.pid;
events { worker_connections 768; }
http {
    sendfile on;
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    include /etc/nginx/sites-enabled/*;
}
NGINXCONF
ok "Nginx configured"

# Extract panel
log "Extract panel files..."
mkdir -p /root/panel
cd /root
unzip -q panel-setup/deployflow-panel.zip -d /tmp/dp-extract/ 2>/dev/null

# Cari folder backend dan frontend
EXTRACTED=$(find /tmp/dp-extract -name "server.js" -maxdepth 5 | head -1 | xargs dirname 2>/dev/null)
if [ -z "$EXTRACTED" ]; then
  # Coba struktur lain
  EXTRACTED=$(find /tmp/dp-extract -name "package.json" -path "*/backend/*" -maxdepth 5 | head -1 | xargs dirname 2>/dev/null)
fi

if [ -n "$EXTRACTED" ]; then
  PANEL_BASE=$(dirname "$EXTRACTED")
  cp -r "$PANEL_BASE/backend" /root/panel/ 2>/dev/null || true
  cp -r "$PANEL_BASE/frontend" /root/panel/ 2>/dev/null || true
else
  # Fallback: copy semua
  cp -r /tmp/dp-extract/*/* /root/panel/ 2>/dev/null || cp -r /tmp/dp-extract/* /root/panel/ 2>/dev/null || true
fi
rm -rf /tmp/dp-extract
ok "Panel files extracted to /root/panel/"

# Backend setup
log "Install backend dependencies..."
cd /root/panel/backend
npm install --silent 2>/dev/null
ok "Backend dependencies installed"

# Generate .env
if [ ! -f .env ]; then
  cp .env.example .env 2>/dev/null || cat > .env << 'ENVFILE'
PORT=4000
NODE_ENV=production
JWT_SECRET=PLACEHOLDER
CORS_ORIGIN=*
APPS_DIR=/root/apps
NGINX_DIR=/etc/nginx/sites-enabled
STATIC_ROOT=/var/www
PORT_START=3100
PORT_END=3999
ENVFILE

  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
  sed -i "s/PLACEHOLDER/$JWT_SECRET/" .env
  ok ".env created with random JWT secret"
fi

# Frontend build
log "Install & build frontend..."
cd /root/panel/frontend
npm install --silent 2>/dev/null
npm run build --silent 2>/dev/null && ok "Frontend built!" || warn "Frontend build gagal, coba manual: cd /root/panel/frontend && npm run build"

# Start script
cat > /root/start-deployflow.sh << 'STARTSCRIPT'
#!/bin/bash
echo "🚀 Starting DeployFlow..."

# Nginx
service nginx start 2>/dev/null || nginx 2>/dev/null || true

# Restore PM2 apps (project user yang sebelumnya jalan)
pm2 resurrect 2>/dev/null || true

# Start cloudflared jika sudah dikonfigurasi
if [ -f /root/.cloudflared/config.yml ]; then
  pkill cloudflared 2>/dev/null || true
  cloudflared tunnel run 2>/dev/null &
  echo "  cloudflared started"
fi

# Start backend panel
cd /root/panel/backend
pm2 delete deployflow-panel 2>/dev/null || true
pm2 start server.js --name deployflow-panel
pm2 save

echo ""
echo "✅ DeployFlow aktif!"
echo "   Local : http://localhost:4000"
echo ""
pm2 list
STARTSCRIPT
chmod +x /root/start-deployflow.sh

ok "Setup Ubuntu selesai!"
echo ""
echo "UBUNTU_SETUP_DONE"
UBUNTU_INSTALL

chmod +x "$UBUNTU_ROOT/root/panel-setup/install.sh"

# Jalankan di dalam Ubuntu
proot-distro login ubuntu -- bash /root/panel-setup/install.sh

ok "Semua terinstall di Ubuntu!"

# ============================================================
# STEP 5 - Setup Termux:Boot (auto-start)
# ============================================================
head "STEP 5/7 — Setup Auto-Start (Termux:Boot)"

mkdir -p "$HOME/.termux/boot"
cat > "$HOME/.termux/boot/deployflow.sh" << 'BOOTSCRIPT'
#!/data/data/com.termux/files/usr/bin/bash
# Auto-start DeployFlow waktu HP reboot
sleep 8
proot-distro login ubuntu -- bash /root/start-deployflow.sh
BOOTSCRIPT
chmod +x "$HOME/.termux/boot/deployflow.sh"
ok "Auto-start dikonfigurasi via Termux:Boot"

# ============================================================
# STEP 6 - Shortcut command di Termux
# ============================================================
head "STEP 6/7 — Buat Shortcut Commands"

cat >> "$HOME/.bashrc" << 'ALIASES'

# DeployFlow shortcuts
alias deployflow-start='proot-distro login ubuntu -- bash /root/start-deployflow.sh'
alias deployflow-stop='proot-distro login ubuntu -- pm2 stop all'
alias deployflow-logs='proot-distro login ubuntu -- pm2 logs deployflow-panel'
alias deployflow-status='proot-distro login ubuntu -- pm2 list'
alias ubuntu='proot-distro login ubuntu'
ALIASES

ok "Shortcuts added:"
echo -e "  ${YELLOW}deployflow-start${NC}  → nyalain panel"
echo -e "  ${YELLOW}deployflow-stop${NC}   → matiin semua"
echo -e "  ${YELLOW}deployflow-logs${NC}   → lihat log backend"
echo -e "  ${YELLOW}deployflow-status${NC} → status PM2"
echo -e "  ${YELLOW}ubuntu${NC}            → masuk Ubuntu"

# ============================================================
# STEP 7 - Jalankan Sekarang
# ============================================================
head "STEP 7/7 — Jalankan DeployFlow"

log "Menjalankan panel..."
proot-distro login ubuntu -- bash /root/start-deployflow.sh

# ============================================================
# DONE
# ============================================================
echo ""
echo -e "${GREEN}${BOLD}"
cat << 'DONE'
╔══════════════════════════════════════════════════════╗
║                                                      ║
║   ✅  SETUP SELESAI! DeployFlow sudah jalan!         ║
║                                                      ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║   Buka panel di browser HP:                          ║
║   👉  http://localhost:4000                          ║
║                                                      ║
║   LANGKAH SELANJUTNYA:                               ║
║   1. Buka http://localhost:4000 di browser           ║
║   2. Klik "Setup pertama kali" → buat akun admin     ║
║   3. Pergi ke Settings                               ║
║   4. Isi Cloudflare API Token & Tunnel ID            ║
║      (supaya bisa akses dari internet)               ║
║                                                      ║
║   SHORTCUT (ketik di Termux):                        ║
║   deployflow-start  → nyalain                        ║
║   deployflow-logs   → lihat log                      ║
║   deployflow-status → cek status                     ║
║                                                      ║
║   Auto-start sudah aktif.                            ║
║   Panel nyala otomatis kalau HP restart. ✓           ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
DONE
echo -e "${NC}"
echo -e "${YELLOW}Note: Jalankan 'source ~/.bashrc' atau restart Termux${NC}"
echo -e "${YELLOW}      agar shortcut commands aktif.${NC}"
echo ""
