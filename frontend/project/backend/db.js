// db.js - SQLite Database Setup
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = process.env.DB_PATH || path.join(__dirname, 'database');
const DB_FILE = path.join(DB_DIR, 'panel.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_FILE);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    email       TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id      TEXT UNIQUE NOT NULL,
    user_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    repo_url    TEXT,
    branch      TEXT DEFAULT 'main',
    framework   TEXT DEFAULT 'react',
    project_type TEXT DEFAULT 'unknown',
    domain      TEXT,
    subdomain   TEXT,
    port        INTEGER,
    status      TEXT DEFAULT 'idle',
    pm2_name    TEXT,
    nginx_file  TEXT,
    cf_record_id TEXT,
    env_vars    TEXT DEFAULT '{}',
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS deployments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      INTEGER NOT NULL,
    status          TEXT DEFAULT 'building',
    commit_hash     TEXT,
    commit_message  TEXT DEFAULT 'Manual deployment',
    logs            TEXT DEFAULT '',
    duration        INTEGER DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ports (
    port    INTEGER PRIMARY KEY,
    app_id  TEXT,
    in_use  INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS settings (
    key     TEXT PRIMARY KEY,
    value   TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
  CREATE INDEX IF NOT EXISTS idx_deployments_project ON deployments(project_id);
`);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Assign a free port starting from PORT_START
 */
function assignPort(appId) {
  const PORT_START = parseInt(process.env.PORT_START || '3100');
  const PORT_END   = parseInt(process.env.PORT_END   || '4000');

  for (let p = PORT_START; p < PORT_END; p++) {
    const existing = db.prepare('SELECT port FROM ports WHERE port = ?').get(p);
    if (!existing) {
      db.prepare('INSERT INTO ports (port, app_id) VALUES (?, ?)').run(p, appId);
      return p;
    }
  }
  throw new Error('No free ports available');
}

/**
 * Release port when project is deleted
 */
function releasePort(port) {
  db.prepare('DELETE FROM ports WHERE port = ?').run(port);
}

/**
 * Generate unique app ID like app-9282
 */
function generateAppId() {
  const num = Math.floor(1000 + Math.random() * 90000);
  const id  = `app-${num}`;
  const exists = db.prepare('SELECT id FROM projects WHERE app_id = ?').get(id);
  return exists ? generateAppId() : id;
}

/**
 * Get or set a setting
 */
function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row?.value ?? null;
}

function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

module.exports = { db, assignPort, releasePort, generateAppId, getSetting, setSetting };
