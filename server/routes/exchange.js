// server/routes/exchange.js — PostgreSQL
const express = require('express');
const router  = express.Router();
const { getPool, getClient } = require('./db');

const floorTo3Decimal = (num) => {
  const n = parseFloat(num) || 0;
  return Math.floor(n * 1000) / 1000;
};

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
        }if (cash > 0 && rate > 0) {
  const goldEquivalent = cash / rate;
  pendingOB = Math.max(0, pendingOB - goldEquivalent);
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
      SELECT
        voucher_no,
        voucher_date,
        COALESCE(actual_pure_wt, 0) AS actual_pure_wt,
        COALESCE(total_pure_wt, 0) AS total_pure_wt,
        COALESCE(pure_wt_given, 0) AS pure_wt_given,
        COALESCE(diff_gold, 0) AS diff_gold,
        COALESCE(cash_given, 0) AS cash_given,
        COALESCE(rate_per_gram, 0) AS rate_per_gram,
        COALESCE(ob_skipped, 0) AS ob_skipped,
        COALESCE(required_cash, 0) AS required_cash,
        COALESCE(extra_cash, 0) AS extra_cash,
        COALESCE(ob_applied, 0) AS ob_applied,
        COALESCE(ob_cash_applied, 0) AS ob_cash_applied,
        COALESCE(use_ob, 1) AS use_ob,
        COALESCE(use_ob_cash, 1) AS use_ob_cash,
        transaction_type
      FROM exchange_vouchers
      WHERE customer_id = $1
      ORDER BY created_at ASC
    `, [req.params.customerId]);

    if (!vs.rows.length) {
      return res.json({
        success: true,
        ob_gold: 0,
        ob_cash: 0,
        has_history: false,
        ob_items: []
      });
    }

    let runningGoldOB = 0;
    let runningCashOB = 0;
    let openItems = [];

    for (const v of vs.rows) {
      const diffGold = parseFloat(v.diff_gold) || 0;
      const obApplied = parseFloat(v.ob_applied) || 0;
      const obCashApplied = parseFloat(v.ob_cash_applied) || 0;
      const extraCash = parseFloat(v.extra_cash) || 0;
      const useOb = parseInt(v.use_ob) || 0;
      const useObCash = parseInt(v.use_ob_cash) || 0;

      // Reduce old gold OB if applied in this voucher
      if (useOb === 1 && obApplied > 0.001) {
        let remainingToAdjust = obApplied;

        openItems = openItems.map(item => {
          if (remainingToAdjust <= 0) return item;

          const amt = parseFloat(item.ob_amount) || 0;
          const used = Math.min(amt, remainingToAdjust);
          remainingToAdjust -= used;

          return {
            ...item,
            ob_amount: parseFloat((amt - used).toFixed(3))
          };
        }).filter(item => parseFloat(item.ob_amount) > 0.001);

        runningGoldOB = parseFloat(
          openItems.reduce((s, item) => s + (parseFloat(item.ob_amount) || 0), 0).toFixed(3)
        );
      }

      // Reduce old cash OB if applied in this voucher
      if (useObCash === 1 && obCashApplied > 0.009) {
        runningCashOB = Math.max(
          0,
          parseFloat((runningCashOB - obCashApplied).toFixed(2))
        );
      }

      // Add new gold OB from SALES transaction (extra gold given)
      if (v.transaction_type === 'sales' && diffGold > 0.001) {
        runningGoldOB = parseFloat((runningGoldOB + diffGold).toFixed(3));
        openItems.push({
          voucher_no: v.voucher_no,
          voucher_date: v.voucher_date,
          ob_amount: parseFloat(diffGold).toFixed(3)
        });
      }

      // Add new cash OB from PURCHASE transaction (extra cash still pending)
      if (v.transaction_type === 'purchase' && extraCash > 0.009) {
        runningCashOB = parseFloat((runningCashOB + extraCash).toFixed(2));
      }
    }

    return res.json({
      success: true,
      ob_gold: runningGoldOB,
      ob_cash: runningCashOB,
      has_history: true,
      ob_items: openItems.filter(item => parseFloat(item.ob_amount) > 0.001)
    });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
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
const oldPureTouch  = parseFloat(oldVoucher.pure_touch) || 99.92;
const oldConvertedGiven = oldPureGiven > 0
  ? floorTo3Decimal((oldPureGiven * oldPureTouch) / 100)
  : 0;
const oldNetEffect  = oldActualPure - oldConvertedGiven;

    // Recompute totals from incoming items
    const totalKatchaWt = items.reduce((s, i) => s + (parseFloat(i.katcha_wt) || 0), 0);
    const totalPureWt   = items.reduce((s, i) => s + (parseFloat(i.pure_wt) || 0), 0);

   const pureTouchVal   = parseFloat(vd.pure_touch) || 99.92;
const itemPureTotal  = floorTo3Decimal(totalPureWt); // already from item pure_wt rows
const cashGoldGiven  = parseFloat(vd.pure_gold_given) || 0;
const cashForRem     = parseFloat(vd.cash_for_remaining) || 0;
const ratePerGram    = parseFloat(vd.rate_per_gram) || 0;

const actualPureGold = cashGoldGiven > 0
  ? floorTo3Decimal((cashGoldGiven * pureTouchVal) / 100)
  : 0;

const netPureOwed = parseFloat((parseFloat(vd.total_pure_wt) || itemPureTotal).toFixed(3));

const pendingGold = Math.max(0, parseFloat((netPureOwed - actualPureGold).toFixed(3)));
const requiredCash = ratePerGram > 0
  ? parseFloat((pendingGold * ratePerGram).toFixed(2))
  : 0;

const extraCash = Math.max(0, parseFloat((cashForRem - requiredCash).toFixed(2)));
const settlementCash = Math.min(cashForRem, requiredCash);
const cashGoldEquivalent = ratePerGram > 0
  ? parseFloat((settlementCash / ratePerGram).toFixed(3))
  : 0;

const balancePure = parseFloat((actualPureGold - netPureOwed).toFixed(3));
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
    ob_applied        = $17,
    ob_cash_applied   = $18,
    use_ob            = $19,
    use_ob_cash       = $20,
    required_cash     = $21,
    extra_cash        = $22,
    remarks           = $23,
    updated_at        = NOW()
  WHERE id = $24
`, [
  vd.voucher_date,
  vd.customer_id || null,
  vd.mobile,
  vd.customer_name,
  parseFloat(totalKatchaWt.toFixed(3)),
  parseFloat(totalKatchaWt.toFixed(3)),
  itemPureTotal,
  netPureOwed,
  cashGoldGiven,
  cashForRem,
  balancePure,
  ratePerGram,
  pureTouchVal,
  vd.transaction_type || 'nil',
  parseFloat(vd.diff_gold) || 0,
  parseFloat(vd.ob_skipped) || 0,
  parseFloat(vd.ob_applied) || 0,
  parseFloat(vd.ob_cash_applied) || 0,
  parseInt(vd.use_ob) || 0,
  parseInt(vd.use_ob_cash) || 0,
  requiredCash,
  extraCash,
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
   const newNetEffect = itemPureTotal - actualPureGold;
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
     itemPureTotal,
actualPureGold,
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

const pureTouchVal  = parseFloat(vd.pure_touch) || 99.92;
const itemPureTotal = floorTo3Decimal(totalPureWt);

const cashGoldGiven = parseFloat(vd.pure_gold_given) || 0;
const cashForRem    = parseFloat(vd.cash_for_remaining) || 0;
const ratePerGram   = parseFloat(vd.rate_per_gram) || 0;

const actualPureGold = cashGoldGiven > 0
  ? floorTo3Decimal((cashGoldGiven * pureTouchVal) / 100)
  : 0;

const netPureOwed   = parseFloat((parseFloat(vd.total_pure_wt) || itemPureTotal).toFixed(3));

const pendingGold = Math.max(0, parseFloat((netPureOwed - actualPureGold).toFixed(3)));
const requiredCash = ratePerGram > 0
  ? parseFloat((pendingGold * ratePerGram).toFixed(2))
  : 0;

const extraCash = Math.max(0, parseFloat((cashForRem - requiredCash).toFixed(2)));
const settlementCash = Math.min(cashForRem, requiredCash);
const cashGoldEquivalent = ratePerGram > 0
  ? parseFloat((settlementCash / ratePerGram).toFixed(3))
  : 0;

const balancePure = parseFloat((actualPureGold - netPureOwed).toFixed(3));
    // Insert voucher
 const vRes = await client.query(`
  INSERT INTO exchange_vouchers
  (
    voucher_no, voucher_date, customer_id, mobile, customer_name,
    total_katcha_wt, total_token_wt, total_gross_wt, actual_pure_wt, total_pure_wt,
    pure_wt_given, cash_given, balance_pure_wt, rate_per_gram,
    pure_touch, transaction_type, diff_gold,
    ob_skipped, ob_applied, ob_cash_applied, use_ob, use_ob_cash,
    required_cash, extra_cash, remarks, status, created_at, updated_at
  )
  VALUES (
    $1,$2,$3,$4,$5,
    $6,0,$7,$8,$9,
    $10,$11,$12,$13,
    $14,$15,$16,
    $17,$18,$19,$20,$21,
    $22,$23,$24,'completed',NOW(),NOW()
  )
  RETURNING id
`, [
  voucherNo,
  vd.voucher_date,
  vd.customer_id || null,
  vd.mobile,
  vd.customer_name,
  parseFloat(totalKatchaWt.toFixed(3)),
  parseFloat(totalKatchaWt.toFixed(3)),
  itemPureTotal,
  netPureOwed,
  cashGoldGiven,
  cashForRem,
  balancePure,
  ratePerGram,
  pureTouchVal,
  vd.transaction_type || 'nil',
  parseFloat(vd.diff_gold) || 0,
  parseFloat(vd.ob_skipped) || 0,
  parseFloat(vd.ob_applied) || 0,
  parseFloat(vd.ob_cash_applied) || 0,
  parseInt(vd.use_ob) || 0,
  parseInt(vd.use_ob_cash) || 0,
  requiredCash,
  extraCash,
  vd.remarks || null
]);
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
      [vd.voucher_date, voucherNo, `Exchange from ${vd.customer_name} (${vd.mobile})`,
       itemPureTotal, actualPureGold, bal + itemPureTotal - actualPureGold]);

    // Reduce customer master OB if applied in this transaction
    if (vd.customer_id) {
      const obAppliedGold = parseFloat(vd.ob_applied) || 0;
      const obAppliedCash = parseFloat(vd.ob_cash_applied) || 0;
      const useOb = parseInt(vd.use_ob) || 0;
      const useObCash = parseInt(vd.use_ob_cash) || 0;

      if ((useOb === 1 && obAppliedGold > 0.001) || (useObCash === 1 && obAppliedCash > 0.009)) {
        await client.query(`
          UPDATE customers
          SET
            ob_gold = GREATEST(0, COALESCE(ob_gold, 0) - $1),
            ob_cash = GREATEST(0, COALESCE(ob_cash, 0) - $2),
            updated_at = NOW()
          WHERE id = $3
        `, [
          useOb === 1 ? obAppliedGold : 0,
          useObCash === 1 ? obAppliedCash : 0,
          vd.customer_id
        ]);
      }
    }

    await client.query('COMMIT');
    res.json({ success:true, voucher_no:voucherNo, id:voucherId });
  } catch(e) { await client.query('ROLLBACK'); res.json({ success:false, error:e.message }); }
  finally { client.release(); }
});

module.exports = router;
