const express = require('express');
const router  = express.Router();
const { getPool } = require('./db');

/* =========================
   GET ALL GOLD ENTRIES
========================= */
router.get('/', async (req, res) => {
  try {
    const r = await getPool().query(`
      SELECT * 
      FROM gold_entries 
      ORDER BY created_at DESC 
      LIMIT 100
    `);

    res.json({ success: true, rows: r.rows });

  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});


/* =========================
   CREATE GOLD ENTRY
========================= */
router.post('/', async (req, res) => {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const d = req.body;

    const type = (d.entry_type || '').toUpperCase();
    const pureWt = parseFloat(d.pure_wt) || 0;
    const entryDate = d.entry_date || new Date();

    /* =========================
       VALIDATION
    ========================= */
    if (!['IN', 'OUT'].includes(type)) {
      throw new Error('Invalid entry_type (must be IN/OUT)');
    }

    if (pureWt <= 0) {
      throw new Error('Pure weight must be greater than 0');
    }

    /* =========================
       GET LAST STOCK BALANCE
    ========================= */
 const master = await client.query(`
  SELECT COALESCE(opening_gold_stock, 0) AS opening_gold_stock
  FROM stock_master
  ORDER BY id ASC
  LIMIT 1
`);

const opening = parseFloat(master.rows[0]?.opening_gold_stock || 0);

const ledgerTotals = await client.query(`
  SELECT
    COALESCE(SUM(dr_pure_wt), 0) AS total_in,
    COALESCE(SUM(cr_pure_wt), 0) AS total_out
  FROM stock_ledger
`);

const totalIn = parseFloat(ledgerTotals.rows[0]?.total_in || 0);
const totalOut = parseFloat(ledgerTotals.rows[0]?.total_out || 0);

let prevBalance = opening + totalIn - totalOut;
prevBalance = parseFloat(prevBalance.toFixed(3));

    /* =========================
       PREVENT NEGATIVE STOCK
    ========================= */
    if (type === 'OUT' && pureWt > prevBalance) {
      throw new Error(`Insufficient stock. Available: ${prevBalance}`);
    }

    /* =========================
       GENERATE ENTRY NUMBER
    ========================= */
    const seq = await client.query(`
      UPDATE voucher_sequences 
      SET current_no = current_no + 1 
      WHERE voucher_type = 'GOLD_ENTRY' 
      RETURNING prefix, current_no
    `);

    const { prefix, current_no } = seq.rows[0];
    const yr = new Date().getFullYear().toString().slice(-2);
    const entryNo = `${prefix}${yr}${String(current_no).padStart(4,'0')}`;

    /* =========================
       INSERT GOLD ENTRY
    ========================= */
    const insertGold = await client.query(`
      INSERT INTO gold_entries 
      (entry_no, entry_date, customer_id, mobile, customer_name, entry_type, weight, touch, pure_wt, remarks, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
      RETURNING *
    `, [
      entryNo,
      entryDate,
      d.customer_id || null,
      d.mobile,
      d.customer_name,
      type,
      parseFloat(d.weight) || 0,
      parseFloat(d.touch) || 0,
      pureWt,
      d.remarks || null
    ]);

    /* =========================
       CALCULATE STOCK EFFECT
    ========================= */
    const dr = type === 'IN' ? parseFloat(pureWt.toFixed(3)) : 0;
    const cr = type === 'OUT' ? parseFloat(pureWt.toFixed(3)) : 0;

    const newBalance = prevBalance + dr - cr;

    /* =========================
       INSERT STOCK LEDGER
    ========================= */
    await client.query(`
      INSERT INTO stock_ledger
      (entry_date, entry_type, ref_type, ref_no, description, dr_pure_wt, cr_pure_wt, balance_pure_wt, created_at)
      VALUES ($1,'gold_entry','gold_entry',$2,$3,$4,$5,$6,NOW())
    `, [
      entryDate,
      entryNo,
      `Gold ${type} - ${d.customer_name || 'Direct'} (${entryNo})`,
      dr,
      cr,
      parseFloat(newBalance.toFixed(3))
    ]);

    await client.query('COMMIT');

    res.json({
      success: true,
      entry_no: entryNo,
      id: insertGold.rows[0].id,
      row: insertGold.rows[0]
    });

  } catch (e) {
    await client.query('ROLLBACK');

    res.json({
      success: false,
      error: e.message
    });

  } finally {
    client.release();
  }
});

module.exports = router;