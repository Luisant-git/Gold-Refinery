const express = require('express');
const router  = express.Router();
const { getPool } = require('./db');

router.get('/latest', async (req, res) => {
  try {
    const r=await getPool().query(`SELECT * FROM rates ORDER BY rate_date DESC, id DESC LIMIT 1`);
    res.json(r.rows[0]||null);
  } catch(e) { res.json(null); }
});

router.get('/', async (req, res) => {
  try {
    const r=await getPool().query(`SELECT * FROM rates ORDER BY rate_date DESC LIMIT 50`);
    res.json({ success:true, rows:r.rows });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { rate_date, rate_24k, rate_22k, rate_18k } = req.body;
    const r=await getPool().query(`INSERT INTO rates (rate_date,rate_24k,rate_22k,rate_18k,created_at) VALUES ($1,$2,$3,$4,NOW()) RETURNING id`,
      [rate_date,parseFloat(rate_24k),parseFloat(rate_22k)||null,parseFloat(rate_18k)||null]);
    res.json({ success:true, id:r.rows[0].id });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

module.exports = router;
