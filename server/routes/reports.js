const express = require('express');
const router  = express.Router();
const { getPool } = require('./db');

router.get('/summary', async (req, res) => {
  try {
    const pool=getPool();
    const today=new Date().toISOString().split('T')[0];
    const [ex,sl,pu,st,cu]=await Promise.all([
      pool.query(`SELECT COUNT(*) AS cnt FROM exchange_vouchers WHERE voucher_date=$1`,[today]),
      pool.query(`SELECT COUNT(*) AS cnt, COALESCE(SUM(net_amount),0) AS total FROM sales_vouchers WHERE voucher_date=$1`,[today]),
      pool.query(`SELECT COUNT(*) AS cnt, COALESCE(SUM(net_amount),0) AS total FROM purchase_vouchers WHERE voucher_date=$1`,[today]),
      pool.query(`SELECT COALESCE(MAX(balance_pure_wt),0) AS bal FROM stock_ledger`),
      pool.query(`SELECT COUNT(*) AS cnt FROM customers`),
    ]);
    res.json({ success:true, today:{ exchange_count:parseInt(ex.rows[0].cnt), sales_count:parseInt(sl.rows[0].cnt), sales_total:parseFloat(sl.rows[0].total), purchase_count:parseInt(pu.rows[0].cnt), purchase_total:parseFloat(pu.rows[0].total), stock_balance:parseFloat(st.rows[0].bal), customer_count:parseInt(cu.rows[0].cnt) } });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

module.exports = router;
