const express = require('express');
const router  = express.Router();
const { getPool } = require('./db');
router.get('/', async (req, res) => {
  try { const r=await getPool().query(`SELECT * FROM touch_masters ORDER BY touch_pct DESC`); res.json({ success:true, rows:r.rows }); }
  catch(e) { res.json({ success:false, error:e.message }); }
});
router.post('/', async (req, res) => {
  try { const { touch_name, touch_pct }=req.body; const r=await getPool().query(`INSERT INTO touch_masters (touch_name,touch_pct,created_at) VALUES ($1,$2,NOW()) RETURNING id`,[touch_name,parseFloat(touch_pct)]); res.json({ success:true, id:r.rows[0].id }); }
  catch(e) { res.json({ success:false, error:e.message }); }
});
module.exports = router;
