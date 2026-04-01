const express = require('express');
const router = express.Router();
const { getPool } = require('./db');

// Get all tokens
router.get('/', async (_req, res) => {
  try {
    const result = await getPool().query(`
      SELECT id, token_no, pure_touch, created_at
      FROM pure_token_master
      ORDER BY token_no ASC
    `);
    res.json({ rows: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create token
router.post('/', async (req, res) => {
  try {
    const { token_no, pure_touch } = req.body;

    if (!token_no || !token_no.trim()) {
      return res.status(400).json({ error: 'Token number is required' });
    }
    if (pure_touch === undefined || pure_touch === null || pure_touch === '') {
      return res.status(400).json({ error: 'Pure touch is required' });
    }

    const result = await getPool().query(
      `INSERT INTO pure_token_master (token_no, pure_touch)
       VALUES ($1, $2)
       RETURNING *`,
      [token_no.trim(), pure_touch]
    );

    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update token
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { token_no, pure_touch } = req.body;

    if (!token_no || !token_no.trim()) {
      return res.status(400).json({ error: 'Token number is required' });
    }
    if (pure_touch === undefined || pure_touch === null || pure_touch === '') {
      return res.status(400).json({ error: 'Pure touch is required' });
    }

    const result = await getPool().query(
      `UPDATE pure_token_master
       SET token_no = $1,
           pure_touch = $2
       WHERE id = $3
       RETURNING *`,
      [token_no.trim(), pure_touch, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Token not found' });
    }

    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete token
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await getPool().query(
      `DELETE FROM pure_token_master
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Token not found' });
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;