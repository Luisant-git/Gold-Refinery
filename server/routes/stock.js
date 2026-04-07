const express = require('express');
const router = express.Router();
const { getPool } = require('./db');

// Gold ledger
router.get('/ledger', async (req, res) => {
  try {
    const { date_from, date_to, ref_type } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (date_from) {
      params.push(date_from);
      where += ` AND entry_date >= $${params.length}`;
    }

    if (date_to) {
      params.push(date_to);
      where += ` AND entry_date <= $${params.length}`;
    }

    if (ref_type) {
      params.push(ref_type);
      where += ` AND ref_type = $${params.length}`;
    }

    const r = await getPool().query(`
      SELECT *
      FROM stock_ledger
      ${where}
      ORDER BY id DESC
    `, params);

    res.json({ success: true, rows: r.rows });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Cash statement
router.get('/cash', async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (date_from) {
      params.push(date_from);
      where += ` AND entry_date >= $${params.length}`;
    }

    if (date_to) {
      params.push(date_to);
      where += ` AND entry_date <= $${params.length}`;
    }

    const r = await getPool().query(`
      SELECT
        entry_date,
        entry_no AS ref_no,
        customer_name,
        entry_type,
        amount,
        'cash' AS source,
        remarks,
        created_at
      FROM cash_entries
      ${where}
      ORDER BY entry_date DESC, created_at DESC
    `, params);

    res.json({ success: true, rows: r.rows });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Bank statement
router.get('/bank', async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (date_from) {
      params.push(date_from);
      where += ` AND entry_date >= $${params.length}`;
    }

    if (date_to) {
      params.push(date_to);
      where += ` AND entry_date <= $${params.length}`;
    }

    const r = await getPool().query(`
      SELECT *
      FROM bank_entries
      ${where}
      ORDER BY entry_date DESC, created_at DESC
    `, params);

    res.json({ success: true, rows: r.rows });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Current stock
router.get('/current', async (req, res) => {
  try {
    const pool = getPool();

    const master = await pool.query(`
      SELECT COALESCE(opening_gold_stock, 0) AS opening_gold_stock
      FROM stock_master
      ORDER BY id ASC
      LIMIT 1
    `);

    const opening = parseFloat(master.rows[0]?.opening_gold_stock || 0);

    const ledger = await pool.query(`
      SELECT
        COALESCE(SUM(dr_pure_wt), 0) AS total_in,
        COALESCE(SUM(cr_pure_wt), 0) AS total_out
      FROM stock_ledger
    `);

    const totalIn = parseFloat(ledger.rows[0]?.total_in || 0);
    const totalOut = parseFloat(ledger.rows[0]?.total_out || 0);

    const balance = opening + totalIn - totalOut;

    res.json({
      success: true,
      row: { balance: parseFloat(balance.toFixed(3)) }
    });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Stock master
// Stock master
router.get('/master', async (req, res) => {
  try {
    const r = await getPool().query(`
      SELECT id, opening_gold_stock, opening_cash_balance, updated_at
      FROM stock_master
      ORDER BY id ASC
      LIMIT 1
    `);

    res.json({
      success: true,
      row: r.rows[0] || {
        id: null,
        opening_gold_stock: 0,
        opening_cash_balance: 0,
        updated_at: null
      }
    });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

router.put('/master', async (req, res) => {
  try {
    const openingGoldStock = parseFloat(req.body.opening_gold_stock) || 0;
    const openingCashBalance = parseFloat(req.body.opening_cash_balance) || 0;
    const pool = getPool();

    const existing = await pool.query(`
      SELECT id
      FROM stock_master
      ORDER BY id ASC
      LIMIT 1
    `);

    let row;

    if (existing.rows.length > 0) {
      const updated = await pool.query(`
        UPDATE stock_master
        SET opening_gold_stock = $1,
            opening_cash_balance = $2,
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `, [openingGoldStock, openingCashBalance, existing.rows[0].id]);

      row = updated.rows[0];
    } else {
      const inserted = await pool.query(`
        INSERT INTO stock_master (opening_gold_stock, opening_cash_balance, updated_at)
        VALUES ($1, $2, NOW())
        RETURNING *
      `, [openingGoldStock, openingCashBalance]);

      row = inserted.rows[0];
    }

    res.json({ success: true, row });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});



router.post('/rebuild', async (req, res) => {
  try {
    const pool = getPool();

    const master = await pool.query(`
      SELECT COALESCE(opening_gold_stock, 0) AS opening_gold_stock
      FROM stock_master
      ORDER BY id ASC
      LIMIT 1
    `);

    let running = parseFloat(master.rows[0]?.opening_gold_stock || 0);

    const rows = await pool.query(`
      SELECT id,
             COALESCE(dr_pure_wt, 0) AS dr_pure_wt,
             COALESCE(cr_pure_wt, 0) AS cr_pure_wt
      FROM stock_ledger
      ORDER BY id ASC
    `);

    for (const row of rows.rows) {
      const dr = parseFloat(row.dr_pure_wt) || 0;
      const cr = parseFloat(row.cr_pure_wt) || 0;

      running = running + dr - cr;

      await pool.query(`
        UPDATE stock_ledger
        SET balance_pure_wt = $1
        WHERE id = $2
      `, [parseFloat(running.toFixed(3)), row.id]);
    }

    res.json({
      success: true,
      message: 'Stock ledger rebuilt successfully'
    });
  } catch (e) {
    res.json({
      success: false,
      error: e.message
    });
  }
});

module.exports = router;