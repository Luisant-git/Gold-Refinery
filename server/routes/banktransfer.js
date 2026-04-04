const express = require('express');
const router = express.Router();
const { getPool } = require('./db');

/* -------------------- GET -------------------- */
router.get('/', async (req, res) => {
  try {
    const r = await getPool().query(`
      SELECT * FROM bank_entries
      ORDER BY created_at DESC
      LIMIT 100
    `);
    res.json({ success: true, rows: r.rows });
  } catch (e) {
    console.error('bank-entries GET error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/* -------------------- POST -------------------- */
router.post('/', async (req, res) => {
  try {
    const d = req.body;
    const pool = getPool();

    const dbName = await pool.query('SELECT current_database()');
    console.log('Current DB:', dbName.rows[0].current_database);

    const allSeq = await pool.query('SELECT * FROM voucher_sequences ORDER BY voucher_type');
    console.log('All sequences:', allSeq.rows);

    const seq = await pool.query(`
      UPDATE voucher_sequences
      SET current_no = current_no + 1
      WHERE voucher_type = 'BANK_ENTRY'
      RETURNING prefix, current_no
    `);

    console.log('BANK_ENTRY update result:', seq.rows);

    if (!seq.rows.length) {
      return res.status(400).json({
        success: false,
        error: 'BANK_ENTRY sequence not found in voucher_sequences'
      });
    }

    const { prefix, current_no } = seq.rows[0];
    const yr = new Date().getFullYear().toString().slice(-2);
    const entryNo = `${prefix}${yr}${String(current_no).padStart(4, '0')}`;

    const r = await pool.query(`
      INSERT INTO bank_entries
      (entry_no, entry_date, customer_id, mobile, customer_name, entry_type, amount, payment_mode, transaction_id, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
      RETURNING id
    `, [
      entryNo,
      d.entry_date || new Date(),
      d.customer_id || null,
      d.mobile || null,
      d.customer_name || null,
      d.entry_type || null,
      parseFloat(d.amount) || 0,
      d.payment_mode || null,
      d.transaction_id || null
    ]);

    res.json({
      success: true,
      entry_no: entryNo,
      id: r.rows[0].id
    });

  } catch (e) {
    console.error('bank-entry POST error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;