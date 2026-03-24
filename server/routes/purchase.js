// server/routes/purchase.js — PostgreSQL
const express = require('express');
const router  = express.Router();
const { getPool, getClient } = require('./db');

router.get('/customer-ob/:customerId', async (req, res) => {
  try {
    const r = await getPool().query(`SELECT voucher_no, voucher_date, COALESCE(balance_amount,0) AS balance_amount FROM purchase_vouchers WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 10`, [req.params.customerId]);
    let total_ob_cash=0; const ob_items=[];
    for (const v of r.rows) {
      const bal=parseFloat(v.balance_amount)||0;
      if (Math.abs(bal)<0.01) break;
      if (bal>0) { ob_items.push({voucher_no:v.voucher_no,voucher_date:v.voucher_date,ob_amount:bal,type:'pending'}); total_ob_cash+=bal; }
    }
    res.json({ success:true, ob_cash:parseFloat(total_ob_cash.toFixed(2)), ob_items });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

router.get('/', async (req, res) => {
  try {
    const { date_from, date_to, mobile } = req.query;
    let where='WHERE 1=1'; const params=[];
    if (date_from) { params.push(date_from); where+=` AND voucher_date>=$${params.length}`; }
    if (date_to)   { params.push(date_to);   where+=` AND voucher_date<=$${params.length}`; }
    if (mobile)    { params.push(`%${mobile}%`); where+=` AND mobile LIKE $${params.length}`; }
    const r = await getPool().query(`SELECT * FROM purchase_vouchers ${where} ORDER BY created_at DESC`, params);
    res.json({ success:true, rows:r.rows });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const pool=getPool();
    const v=await pool.query(`SELECT * FROM purchase_vouchers WHERE id=$1`,[req.params.id]);
    const items=await pool.query(`SELECT * FROM purchase_voucher_items WHERE voucher_id=$1 ORDER BY sno`,[req.params.id]);
    res.json({ success:true, row:{ ...v.rows[0], items:items.rows } });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

router.post('/', async (req, res) => {
  const { voucherData:vd, items } = req.body;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const seqR = await client.query(`UPDATE voucher_sequences SET current_no=current_no+1 WHERE voucher_type='PURCHASE' RETURNING prefix, current_no`);
    const { prefix, current_no } = seqR.rows[0];
    const yr = new Date().getFullYear().toString().slice(-2);
    const voucherNo = `${prefix}${yr}${String(current_no).padStart(4,'0')}`;
    const totalGross=items.reduce((s,i)=>s+(parseFloat(i.katcha_wt)||parseFloat(i.total_wt)||0),0);
    const totalPure=items.reduce((s,i)=>s+(parseFloat(i.pure_wt)||0),0);
    const grossAmt=items.reduce((s,i)=>s+(parseFloat(i.amount)||0),0);
    const deductions=parseFloat(vd.deductions)||0;
    const netAmount=parseFloat((grossAmt-deductions).toFixed(2));
    const vRes = await client.query(`
      INSERT INTO purchase_vouchers (voucher_no,voucher_date,customer_id,mobile,customer_name,total_gross_wt,total_pure_wt,gross_amount,deductions,net_amount,amount_paid,balance_amount,payment_mode,rate_per_gram,remarks,status,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'completed',NOW(),NOW()) RETURNING id`,
      [voucherNo,vd.voucher_date,vd.customer_id||null,vd.mobile,vd.customer_name,
       parseFloat(totalGross.toFixed(3)),parseFloat(totalPure.toFixed(3)),
       parseFloat(grossAmt.toFixed(2)),deductions,netAmount,
       parseFloat(vd.amount_paid||netAmount),0,
       vd.payment_mode||'cash',parseFloat(vd.rate_per_gram)||0,vd.remarks||null]);
    const voucherId=vRes.rows[0].id;
    for (let i=0;i<items.length;i++) {
      const it=items[i];
      await client.query(`INSERT INTO purchase_voucher_items (voucher_id,sno,item_description,katcha_wt,token_wt,gross_wt,touch,pure_wt,amount) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [voucherId,i+1,it.item_description||'',parseFloat(it.katcha_wt)||0,parseFloat(it.token_wt)||0,parseFloat(it.total_wt||it.katcha_wt)||0,parseFloat(it.touch)||0,parseFloat(it.pure_wt)||0,parseFloat(it.amount)||0]);
    }
    await client.query('COMMIT');
    res.json({ success:true, voucher_no:voucherNo, id:voucherId });
  } catch(e) { await client.query('ROLLBACK'); res.json({ success:false, error:e.message }); }
  finally { client.release(); }
});

module.exports = router;
