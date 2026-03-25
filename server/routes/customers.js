const express = require('express');
const router  = express.Router();
const { getPool } = require('./db');

router.get('/search', async (req, res) => {
  try {
    const q=`%${req.query.q||''}%`;
    const r=await getPool().query(`SELECT * FROM customers WHERE mobile LIKE $1 OR name ILIKE $1 ORDER BY name LIMIT 20`,[q]);
    res.json({ rows: r.rows });
  } catch(e) { res.json({ rows: [] }); }
});

router.get('/by-mobile/:mobile', async (req, res) => {
  try {
    const r=await getPool().query(`SELECT * FROM customers WHERE mobile=$1 LIMIT 1`,[req.params.mobile]);
    res.json({ row: r.rows[0]||null });
  } catch(e) { res.json({ row:null }); }
});

router.get('/', async (req, res) => {
  try {
    const r=await getPool().query(`SELECT * FROM customers ORDER BY name`);
    res.json({ success:true, rows:r.rows });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const d=req.body;
    const r=await getPool().query(`INSERT INTO customers (mobile,name,address,ob_gold,ob_cash,ob_exchange_gold,ob_exchange_cash,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()) RETURNING id`,
      [d.mobile,d.name,d.address||null,parseFloat(d.ob_gold)||0,parseFloat(d.ob_cash)||0,parseFloat(d.ob_exchange_gold)||0,parseFloat(d.ob_exchange_cash)||0]);
    res.json({ success:true, id:r.rows[0].id });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const d=req.body;
    await getPool().query(`UPDATE customers SET mobile=$1,name=$2,address=$3,ob_gold=$4,ob_cash=$5,updated_at=NOW() WHERE id=$6`,
      [d.mobile,d.name,d.address||null,parseFloat(d.ob_gold)||0,parseFloat(d.ob_cash)||0,req.params.id]);
    res.json({ success:true });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

module.exports = router;
