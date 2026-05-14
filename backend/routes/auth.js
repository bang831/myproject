// routes/auth.js - Login & Register
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const { db }  = require('../db');
const { JWT_SECRET, authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Helper: generate UUID tanpa package tambahan
function makeId() {
  return require('crypto').randomUUID
    ? require('crypto').randomUUID()
    : require('crypto').randomBytes(16).toString('hex');
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ error: 'Email atau password salah.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Email atau password salah.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (err) {
    console.error('[AUTH LOGIN]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/register
// Hanya bisa diakses jika belum ada user sama sekali (first-time setup)
router.post('/register', async (req, res) => {
  try {
    const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    if (count > 0) {
      return res.status(403).json({ error: 'Registrasi ditutup. Platform ini private.' });
    }

    const { email, password } = req.body;
    if (!email || !password || password.length < 6) {
      return res.status(400).json({ error: 'Email wajib diisi dan password minimal 6 karakter.' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const id = makeId();

    db.prepare('INSERT INTO users (id, email, password) VALUES (?, ?, ?)')
      .run(id, email.toLowerCase().trim(), hashed);

    const token = jwt.sign({ id, email }, JWT_SECRET, { expiresIn: '7d' });
    return res.status(201).json({ token, user: { id, email } });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Email sudah terdaftar.' });
    }
    console.error('[AUTH REGISTER]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/auth/me - Verifikasi token & return user
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/logout (client cukup hapus token, ini just confirms)
router.post('/logout', authMiddleware, (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
