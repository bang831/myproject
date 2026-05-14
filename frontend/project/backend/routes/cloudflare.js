// routes/cloudflare.js
const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { db } = require('../db');
const cf = require('../lib/cloudflare');

const router = express.Router();
router.use(authMiddleware);

// GET /api/cloudflare/zones - List semua domain dari akun CF
router.get('/zones', async (req, res) => {
  try {
    const zones = await cf.getZones();
    res.json(zones);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/cloudflare/dns?zoneId=XXX - List DNS records
router.get('/dns', async (req, res) => {
  try {
    const { zoneId } = req.query;
    if (!zoneId) return res.status(400).json({ error: 'zoneId wajib diisi.' });
    const records = await cf.getDnsRecords(zoneId);
    res.json(records);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/cloudflare/verify - Verifikasi token
router.post('/verify', async (req, res) => {
  try {
    const valid = await cf.verifyToken();
    res.json({ valid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/settings - Simpan CF token & tunnel ID
router.post('/settings', (req, res) => {
  try {
    const { cf_token, cf_tunnel_id } = req.body;
    if (cf_token)    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('cf_token', cf_token);
    if (cf_tunnel_id) db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('cf_tunnel_id', cf_tunnel_id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal simpan settings.' });
  }
});

// GET /api/cloudflare/settings - Cek apakah sudah dikonfigurasi
router.get('/settings', (req, res) => {
  const hasToken  = !!db.prepare("SELECT value FROM settings WHERE key = 'cf_token'").get()?.value;
  const hasTunnel = !!db.prepare("SELECT value FROM settings WHERE key = 'cf_tunnel_id'").get()?.value;
  res.json({ configured: hasToken, hasTunnel });
});

module.exports = router;
