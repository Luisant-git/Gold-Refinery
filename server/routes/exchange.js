// server/routes/exchange.js — PostgreSQL
const express = require('express');
const router  = express.Router();
const { getPool, getClient } = require('./db');

// Fix ob_skipped retroactively
router.post('/fix-ob-skipped', async (req, res) => {
  try {
    const pool = getPool();
    const custs = await pool.query(`SELECT DISTINCT customer_id FROM exchange_vouchers WHERE customer_id IS NOT NULL`);
    let fixed = 0;
    for (const { customer_id } of custs.rows) {
      const vs = await pool.query(`
        SELECT id, total_pure_wt, pure_wt_given,
               COALESCE(actual_pure_wt,0) AS actual_pure_wt,
               COALESCE(cash_given,0)     AS cash_given,
               COALESCE(rate_per_gram,0)  AS rate_per_gram,
               COALESCE(ob_skipped,0)     AS ob_skipped
        FROM exchange_vouchers WHERE customer_id=$1 ORDER BY created_at ASC`, [customer_id]);
      let pendingOB = 0;
      for (const v of vs.rows) {
        const total=parseFloat(v.total_pure_wt)||0, given=parseFloat(v.pure_wt_given)||0;
        const actual=parseFloat(v.actual_pure_wt)||0, cash=parseFloat(v.cash_given)||0;
        const rate=parseFloat(v.rate_per_gram)||0, diff=parseFloat((given-total).toFixed(3));
        const appliedOB = actual>0.001 ? Math.max(0,parseFloat((actual-total).toFixed(3))) : 0;
        if (appliedOB>0.001) pendingOB=Math.max(0,pendingOB-appliedOB);
        if (Math.abs(diff)<0.001) { pendingOB=0; }
        else if (diff>0) {
          if (pendingOB>0.001 && parseFloat(v.ob_skipped)<0.001) {
            await pool.query(`UPDATE exchange_vouchers SET ob_skipped=$1 WHERE id=$2 AND ob_skipped=0`,[pendingOB,v.id]);
            fixed++;
          }
          pendingOB+=diff;
        } else {
          const pend=Math.abs(diff), cv=rate>0?pend*rate:0;
          if (cash>0&&cv>0&&cash>=cv*0.99) pendingOB=0;
        }
      }
    }
    res.json({ success:true, message:`Migration complete. Fixed ob_skipped on ${fixed} vouchers.`, fixed });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

// Customer OB
router.get('/customer-ob/:customerId', async (req, res) => {
  try {
    const pool = getPool();
    const vs = await pool.query(`
    SELECT voucher_no, voucher_date, total_pure_wt, pure_wt_given,
       COALESCE(balance_pure_wt,0) AS balance_pure_wt,
       COALESCE(cash_given,0) AS cash_given,
       COALESCE(rate_per_gram,0) AS rate_per_gram,
       COALESCE(ob_skipped,0) AS ob_skipped,
       transaction_type
FROM exchange_vouchers
WHERE customer_id=$1
ORDER BY created_at ASC`, [req.params.customerId]);
    if (!vs.rows.length) return res.json({ success:true, ob_gold:0, ob_cash:0, has_history:false, ob_items:[] });

    // Walk ASC: accumulate running OB gold
    let runningOB = 0;
    for (const v of vs.rows) {
      const netOwed   = parseFloat(v.total_pure_wt) || 0;
      const given     = parseFloat(v.pure_wt_given) || 0;
      const cashGiven = parseFloat(v.cash_given)    || 0;
      const rate      = parseFloat(v.rate_per_gram) || 0;
      const obSkipped = parseFloat(v.ob_skipped)    || 0;
      const diff = parseFloat(v.balance_pure_wt) || 0;// +ve = sales OB, -ve = purchase

      if (diff < -0.001) {
        // Add current voucher pending balance
        runningOB += Math.abs(diff);
      }
    }

    runningOB = parseFloat(runningOB.toFixed(3));

    // Build ob_items from the sales OB vouchers that contributed to current runningOB
    // Re-walk to collect only the uncleared sales OB entries
    const ob_items = [];
    let tempOB = 0;
    let cleared = false;
    for (const v of vs.rows) {
      const netOwed   = parseFloat(v.total_pure_wt) || 0;
      const given     = parseFloat(v.pure_wt_given) || 0;
      const cashGiven = parseFloat(v.cash_given)    || 0;
      const rate      = parseFloat(v.rate_per_gram) || 0;
      const obSkipped = parseFloat(v.ob_skipped)    || 0;
      const diff = parseFloat(v.balance_pure_wt) || 0;

      if (diff < -0.001) {
        ob_items.push({
          voucher_no: v.voucher_no,
          voucher_date: v.voucher_date,
          ob_amount: Math.abs(diff)
        });
        tempOB += Math.abs(diff);
      }
    }

    res.json({ success:true, ob_gold:runningOB, ob_cash:0, has_history:true, ob_items });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

// Next voucher number
router.get('/next-no', async (req, res) => {
  try {
    const r = await getPool().query(`SELECT prefix, current_no FROM voucher_sequences WHERE voucher_type='EXCHANGE'`);
    const { prefix, current_no } = r.rows[0];
    const yr = new Date().getFullYear().toString().slice(-2);
    res.json({ success:true, voucher_no:`${prefix}${yr}${String(current_no+1).padStart(4,'0')}` });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

// Get all
router.get('/', async (req, res) => {
  try {
    const { date_from, date_to, mobile } = req.query;
    let where='WHERE 1=1'; const params=[];
    if (date_from) { params.push(date_from); where+=` AND voucher_date>=$${params.length}`; }
    if (date_to)   { params.push(date_to);   where+=` AND voucher_date<=$${params.length}`; }
    if (mobile)    { params.push(`%${mobile}%`); where+=` AND mobile LIKE $${params.length}`; }
    const r = await getPool().query(`SELECT * FROM exchange_vouchers ${where} ORDER BY created_at DESC`, params);
    res.json({ success:true, rows:r.rows });
  } catch(e) { res.json({ success:false, error:e.message }); }
});


// Update
router.put('/:id', async (req, res) => {
  const { voucherData: vd, items } = req.body;
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const voucherId = req.params.id;

    // Check existing voucher
    const oldVoucherRes = await client.query(
      `SELECT * FROM exchange_vouchers WHERE id = $1`,
      [voucherId]
    );

    if (!oldVoucherRes.rows.length) {
      await client.query('ROLLBACK');
      return res.json({ success: false, error: 'Voucher not found' });
    }

    const oldVoucher = oldVoucherRes.rows[0];

    // Old stock effect
    const oldActualPure = parseFloat(oldVoucher.actual_pure_wt) || 0;
    const oldPureGiven  = parseFloat(oldVoucher.pure_wt_given) || 0;
    const oldNetEffect  = oldActualPure - oldPureGiven;

    // Recompute totals from incoming items
    const totalKatchaWt = items.reduce((s, i) => s + (parseFloat(i.katcha_wt) || 0), 0);
    const totalPureWt   = items.reduce((s, i) => s + (parseFloat(i.pure_wt) || 0), 0);

    const pureTouchVal   = parseFloat(vd.pure_touch) || 99.90;
    const actualPureGold = parseFloat((totalPureWt / pureTouchVal * 100).toFixed(3));
    const cashGoldGiven  = parseFloat(vd.pure_gold_given) || 0;
    const cashForRem     = parseFloat(vd.cash_for_remaining) || 0;
    const netPureOwed    = parseFloat((parseFloat(vd.total_pure_wt) || actualPureGold).toFixed(3));
    const balancePure    = parseFloat((netPureOwed - cashGoldGiven).toFixed(3));

    // Update voucher header
    await client.query(`
      UPDATE exchange_vouchers
      SET
        voucher_date      = $1,
        customer_id       = $2,
        mobile            = $3,
        customer_name     = $4,
        total_katcha_wt   = $5,
        total_token_wt    = 0,
        total_gross_wt    = $6,
        actual_pure_wt    = $7,
        total_pure_wt     = $8,
        pure_wt_given     = $9,
        cash_given        = $10,
        balance_pure_wt   = $11,
        rate_per_gram     = $12,
        pure_touch        = $13,
        transaction_type  = $14,
        diff_gold         = $15,
        ob_skipped        = $16,
        remarks           = $17,
        updated_at        = NOW()
      WHERE id = $18
    `, [
      vd.voucher_date,
      vd.customer_id || null,
      vd.mobile,
      vd.customer_name,
      parseFloat(totalKatchaWt.toFixed(3)),
      parseFloat(totalKatchaWt.toFixed(3)),
      actualPureGold,
      netPureOwed,
      cashGoldGiven,
      cashForRem,
      balancePure,
      parseFloat(vd.rate_per_gram) || 0,
      pureTouchVal,
      vd.transaction_type || 'nil',
      parseFloat(vd.diff_gold) || 0,
      parseFloat(vd.ob_skipped) || 0,
      vd.remarks || null,
      voucherId
    ]);

    // Delete old items
    await client.query(`DELETE FROM exchange_voucher_items WHERE voucher_id = $1`, [voucherId]);

    // Insert new items
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await client.query(`
        INSERT INTO exchange_voucher_items
          (voucher_id, sno, token_no, katcha_wt, katcha_touch, less_touch, balance_touch, pure_wt)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [
        voucherId,
        i + 1,
        it.token_no || null,
        parseFloat(it.katcha_wt) || 0,
        parseFloat(it.katcha_touch) || 0,
        parseFloat(it.less_touch) || 0,
        parseFloat(it.balance_touch) || 0,
        parseFloat(it.pure_wt) || 0
      ]);
    }

    // Update stock ledger entry for this voucher
    const newNetEffect = actualPureGold - cashGoldGiven;
    const diffNet = newNetEffect - oldNetEffect;

    // Update this voucher's stock ledger row
    await client.query(`
      UPDATE stock_ledger
      SET
        entry_date      = $1,
        description     = $2,
        dr_pure_wt      = $3,
        cr_pure_wt      = $4
      WHERE ref_type = 'exchange' AND ref_no = $5
    `, [
      vd.voucher_date,
      `Exchange from ${vd.customer_name} (${vd.mobile})`,
      actualPureGold,
      cashGoldGiven,
      oldVoucher.voucher_no
    ]);

    // Recalculate stock ledger balances from this row onward
    const ledgerRowsRes = await client.query(`
      SELECT id, dr_pure_wt, cr_pure_wt
      FROM stock_ledger
      WHERE id >= (
        SELECT id FROM stock_ledger
        WHERE ref_type = 'exchange' AND ref_no = $1
        ORDER BY id ASC
        LIMIT 1
      )
      ORDER BY id ASC
    `, [oldVoucher.voucher_no]);

    let previousBalance = 0;

    const prevRowRes = await client.query(`
      SELECT balance_pure_wt
      FROM stock_ledger
      WHERE id < (
        SELECT id FROM stock_ledger
        WHERE ref_type = 'exchange' AND ref_no = $1
        ORDER BY id ASC
        LIMIT 1
      )
      ORDER BY id DESC
      LIMIT 1
    `, [oldVoucher.voucher_no]);

    if (prevRowRes.rows.length) {
      previousBalance = parseFloat(prevRowRes.rows[0].balance_pure_wt) || 0;
    }

    for (const row of ledgerRowsRes.rows) {
      const dr = parseFloat(row.dr_pure_wt) || 0;
      const cr = parseFloat(row.cr_pure_wt) || 0;
      const newBalance = previousBalance + dr - cr;

      await client.query(
        `UPDATE stock_ledger SET balance_pure_wt = $1 WHERE id = $2`,
        [parseFloat(newBalance.toFixed(3)), row.id]
      );

      previousBalance = newBalance;
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      voucher_no: oldVoucher.voucher_no,
      id: voucherId
    });
  } catch (e) {
    await client.query('ROLLBACK');
    res.json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

// Get by id
router.get('/:id', async (req, res) => {
  try {
    const pool = getPool();
    const v = await pool.query(`SELECT * FROM exchange_vouchers WHERE id=$1`, [req.params.id]);
    const items = await pool.query(`SELECT * FROM exchange_voucher_items WHERE voucher_id=$1 ORDER BY sno`, [req.params.id]);
    res.json({ success:true, row:{ ...v.rows[0], items:items.rows } });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

// Create
router.post('/', async (req, res) => {
  const { voucherData:vd, items } = req.body;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    // Increment sequence
    const seqR = await client.query(`UPDATE voucher_sequences SET current_no=current_no+1 WHERE voucher_type='EXCHANGE' RETURNING prefix, current_no`);
    const { prefix, current_no } = seqR.rows[0];
    const yr = new Date().getFullYear().toString().slice(-2);
    const voucherNo = `${prefix}${yr}${String(current_no).padStart(4,'0')}`;
    // Compute
    const totalKatchaWt = items.reduce((s,i)=>s+(parseFloat(i.katcha_wt)||0),0);
    const totalPureWt   = items.reduce((s,i)=>s+(parseFloat(i.pure_wt)||0),0);
    const pureTouchVal  = parseFloat(vd.pure_touch)||99.90;
    const actualPureGold = parseFloat((totalPureWt / pureTouchVal * 100).toFixed(3)); 
    const cashGoldGiven = parseFloat(vd.pure_gold_given)||0;
    const cashForRem    = parseFloat(vd.cash_for_remaining)||0;
    const netPureOwed   = parseFloat((parseFloat(vd.total_pure_wt)||actualPureGold).toFixed(3));
    const balancePure   = parseFloat((netPureOwed-cashGoldGiven).toFixed(3));
    // Insert voucher
    const vRes = await client.query(`
      INSERT INTO exchange_vouchers
        (voucher_no,voucher_date,customer_id,mobile,customer_name,
         total_katcha_wt,total_token_wt,total_gross_wt,actual_pure_wt,total_pure_wt,
         pure_wt_given,cash_given,balance_pure_wt,rate_per_gram,
         pure_touch,transaction_type,diff_gold,ob_skipped,remarks,status,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'completed',NOW(),NOW())
      RETURNING id`,
      [voucherNo,vd.voucher_date,vd.customer_id||null,vd.mobile,vd.customer_name,
       parseFloat(totalKatchaWt.toFixed(3)),parseFloat(totalKatchaWt.toFixed(3)),
       actualPureGold,netPureOwed,cashGoldGiven,cashForRem,balancePure,
       parseFloat(vd.rate_per_gram)||0,pureTouchVal,
       vd.transaction_type||'nil',parseFloat(vd.diff_gold)||0,
       parseFloat(vd.ob_skipped)||0,vd.remarks||null]);
    const voucherId = vRes.rows[0].id;
    // Insert items
    for (let i=0; i<items.length; i++) {
      const it=items[i];
      await client.query(`
        INSERT INTO exchange_voucher_items (voucher_id,sno,token_no,katcha_wt,katcha_touch,less_touch,balance_touch,pure_wt)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [voucherId,i+1,it.token_no||null,parseFloat(it.katcha_wt)||0,parseFloat(it.katcha_touch)||0,
         parseFloat(it.less_touch)||0,parseFloat(it.balance_touch)||0,parseFloat(it.pure_wt)||0]);
    }
    // Stock ledger
    const balR = await client.query(`SELECT COALESCE(MAX(id),0) AS lid FROM stock_ledger`);
    let bal=0;
    if (balR.rows[0].lid>0) { const lb=await client.query(`SELECT balance_pure_wt FROM stock_ledger ORDER BY id DESC LIMIT 1`); bal=parseFloat(lb.rows[0].balance_pure_wt)||0; }
    await client.query(`
      INSERT INTO stock_ledger (entry_date,entry_type,ref_type,ref_no,description,dr_pure_wt,cr_pure_wt,balance_pure_wt,created_at)
      VALUES ($1,'receipt','exchange',$2,$3,$4,$5,$6,NOW())`,
      [vd.voucher_date,voucherNo,`Exchange from ${vd.customer_name} (${vd.mobile})`,
       actualPureGold,cashGoldGiven,bal+actualPureGold-cashGoldGiven]);
    await client.query('COMMIT');
    res.json({ success:true, voucher_no:voucherNo, id:voucherId });
  } catch(e) { await client.query('ROLLBACK'); res.json({ success:false, error:e.message }); }
  finally { client.release(); }
});

module.exports = router;
