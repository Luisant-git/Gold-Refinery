const express = require('express');
const router  = express.Router();
const { getPool } = require('./db');
router.get('/', async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const df=date_from||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split('T')[0];
    const dt=date_to||new Date().toISOString().split('T')[0];
    const pool=getPool();
    const [ex,sl,pu]=await Promise.all([
      pool.query(`SELECT COALESCE(SUM(total_gross_wt),0) AS gross, COALESCE(SUM(actual_pure_wt),0) AS pure FROM exchange_vouchers WHERE voucher_date BETWEEN $1 AND $2`,[df,dt]),
      pool.query(`SELECT COALESCE(SUM(total_gross_wt),0) AS gross, COALESCE(SUM(total_pure_wt),0) AS pure, COALESCE(SUM(net_amount),0) AS amt FROM sales_vouchers WHERE voucher_date BETWEEN $1 AND $2`,[df,dt]),
      pool.query(`SELECT COALESCE(SUM(total_gross_wt),0) AS gross, COALESCE(SUM(total_pure_wt),0) AS pure, COALESCE(SUM(net_amount),0) AS amt FROM purchase_vouchers WHERE voucher_date BETWEEN $1 AND $2`,[df,dt]),
    ]);
    res.json({ success:true, exchange:ex.rows[0], sales:sl.rows[0], purchase:pu.rows[0] });
  } catch(e) { res.json({ success:false, error:e.message }); }
});
module.exports = router;
