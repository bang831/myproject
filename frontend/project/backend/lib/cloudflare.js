// lib/cloudflare.js - Cloudflare API Integration
const axios = require('axios');
const { db } = require('../db');

const CF_BASE = 'https://api.cloudflare.com/client/v4';

/**
 * Get Cloudflare credentials dari settings DB
 */
function getCreds() {
  const token = db.prepare("SELECT value FROM settings WHERE key = 'cf_token'").get()?.value;
  const tunnelId = db.prepare("SELECT value FROM settings WHERE key = 'cf_tunnel_id'").get()?.value;
  if (!token) throw new Error('Cloudflare API token belum dikonfigurasi. Set di Settings panel.');
  return { token, tunnelId };
}

/**
 * Buat axios client dengan auth header
 */
function cfClient() {
  const { token } = getCreds();
  return axios.create({
    baseURL: CF_BASE,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
}

/**
 * List semua zones (domains) dari akun Cloudflare
 */
async function getZones() {
  const client = cfClient();
  const res = await client.get('/zones?per_page=50&status=active');
  if (!res.data.success) throw new Error(res.data.errors?.[0]?.message || 'Gagal ambil zones');
  return res.data.result.map(z => ({
    id:     z.id,
    name:   z.name,
    status: z.status,
  }));
}

/**
 * List DNS records untuk satu zone
 */
async function getDnsRecords(zoneId) {
  const client = cfClient();
  const res = await client.get(`/zones/${zoneId}/dns_records?per_page=100`);
  if (!res.data.success) throw new Error(res.data.errors?.[0]?.message || 'Gagal ambil DNS records');
  return res.data.result;
}

/**
 * Buat DNS record CNAME ke Cloudflare Tunnel
 * (tunnel_id.cfargotunnel.com)
 */
async function createDnsRecord({ zoneId, subdomain, domain }) {
  const { tunnelId } = getCreds();
  const client = cfClient();

  const content = tunnelId
    ? `${tunnelId}.cfargotunnel.com`
    : '0.0.0.0'; // fallback jika belum ada tunnel

  const name = subdomain ? `${subdomain}.${domain}` : domain;

  const res = await client.post(`/zones/${zoneId}/dns_records`, {
    type:    'CNAME',
    name,
    content,
    ttl:     1,      // Auto TTL
    proxied: true,   // Cloudflare proxy ON (SSL otomatis)
  });

  if (!res.data.success) {
    const errMsg = res.data.errors?.[0]?.message || 'Gagal buat DNS record';
    throw new Error(errMsg);
  }

  return {
    id:      res.data.result.id,
    name:    res.data.result.name,
    content: res.data.result.content,
  };
}

/**
 * Hapus DNS record
 */
async function deleteDnsRecord(zoneId, recordId) {
  const client = cfClient();
  const res = await client.delete(`/zones/${zoneId}/dns_records/${recordId}`);
  if (!res.data.success) {
    throw new Error(res.data.errors?.[0]?.message || 'Gagal hapus DNS record');
  }
  return true;
}

/**
 * Verifikasi token valid
 */
async function verifyToken() {
  const client = cfClient();
  const res = await client.get('/user/tokens/verify');
  return res.data.success;
}

module.exports = { getZones, getDnsRecords, createDnsRecord, deleteDnsRecord, verifyToken, getCreds };
