const express = require('express');
const router  = express.Router();
const { getPool } = require('./db');
router.get('/', async (req, res) => {
  try { const r=await getPool().query(`SELECT * FROM expenses ORDER BY created_at DESC LIMIT 100`); res.json({ success:true, rows:r.rows }); }
  catch(e) { res.json({ success:false, error:e.message }); }
});
router.post('/', async (req, res) => {
  try {
    const d=req.body;
    const seq=await getPool().query(`UPDATE voucher_sequences SET current_no=current_no+1 WHERE voucher_type='EXPENSE' RETURNING prefix,current_no`);
    const {prefix,current_no}=seq.rows[0]; const yr=new Date().getFullYear().toString().slice(-2);
    const no=`${prefix}${yr}${String(current_no).padStart(4,'0')}`;
    const r=await getPool().query(`INSERT INTO expenses (entry_no,entry_date,expense_type,description,amount,created_at) VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING id`,
      [no,d.entry_date,d.expense_type,d.description||null,parseFloat(d.amount)||0]);
    res.json({ success:true, entry_no:no, id:r.rows[0].id });
  } catch(e) { res.json({ success:false, error:e.message }); }
});
module.exports = router;
