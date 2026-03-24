// server/routes/auth.js
const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();
const { query } = require('./db');

// Simple SHA-256 hash (no external dependency needed)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// ── POST /api/auth/register ───────────────────────
router.post('/register', async (req, res) => {
  try {
    const { username, password, displayName, role } = req.body;

    if (!username || !password) {
      return res.json({ success: false, error: 'Username and password are required' });
    }
    if (password.length < 4) {
      return res.json({ success: false, error: 'Password must be at least 4 characters' });
    }

    // Check if user already exists
    const existing = await query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username]);
    if (existing.length > 0) {
      return res.json({ success: false, error: 'Username already exists' });
    }

    const hashed = hashPassword(password);
    const rows = await query(
      `INSERT INTO users (username, password, display_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, display_name, role`,
      [username.toLowerCase(), hashed, displayName || username, role || 'user']
    );

    res.json({ success: true, user: rows[0] });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ── POST /api/auth/login ──────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.json({ success: false, error: 'Username and password are required' });
    }

    const hashed = hashPassword(password);
    const rows = await query(
      `SELECT id, username, display_name, role, is_active
       FROM users
       WHERE LOWER(username) = LOWER($1) AND password = $2`,
      [username, hashed]
    );

    if (rows.length === 0) {
      return res.json({ success: false, error: 'Invalid username or password' });
    }

    const user = rows[0];
    if (!user.is_active) {
      return res.json({ success: false, error: 'Account is disabled. Contact admin.' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
      },
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ── GET /api/auth/users ───────────────────────────
router.get('/users', async (req, res) => {
  try {
    const rows = await query(
      'SELECT id, username, display_name, role, is_active, created_at FROM users ORDER BY id'
    );
    res.json({ rows });
  } catch (err) {
    res.json({ rows: [], error: err.message });
  }
});

module.exports = router;
