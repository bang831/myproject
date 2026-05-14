// middleware/auth.js - JWT Authentication Middleware
const jwt = require('jsonwebtoken');
const { db } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'ganti-ini-dengan-secret-yang-kuat-di-production';

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token tidak ada. Silakan login.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(decoded.id);
    if (!user) return res.status(401).json({ error: 'User tidak ditemukan.' });
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Silakan login ulang.' });
    }
    return res.status(401).json({ error: 'Token tidak valid.' });
  }
}

module.exports = { authMiddleware, JWT_SECRET };
