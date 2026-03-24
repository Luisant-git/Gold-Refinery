const express = require('express');
const router  = express.Router();
const { getPool } = require('./db');

router.get('/', async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    let where='WHERE 1=1'; const params=[];
    if (date_from) { params.push(date_from); where+=` AND entry_date>=$${params.length}`; }
    if (date_to)   { params.push(date_to);   where+=` AND entry_date<=$${params.length}`; }
    const r=await getPool().query(`SELECT * FROM stock_ledger ${where} ORDER BY id DESC`,params);
    res.json({ success:true, rows:r.rows });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

module.exports = router;
