// server/index.js
require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { getPool } = require('./routes/db');
 
const app  = express();
const PORT = process.env.PORT || 3001;
 
app.use(cors());
app.use(express.json({ limit:'10mb' }));
 
// ── DB health ─────────────────────────────────────
app.get('/api/db/status', async (req, res) => {
  try {
    await getPool().query('SELECT 1');
    res.json({ connected: true });
  } catch(e) { res.json({ connected: false, error: e.message }); }
});
 
app.post('/api/db/test', async (req, res) => {
  const { host, port, database, user, password } = req.body;
  const { Pool } = require('pg');
  const testPool = new Pool({ host, port: parseInt(port||5432), database, user, password, connectionTimeoutMillis: 5000 });
  try {
    await testPool.query('SELECT 1');
    await testPool.end();
    res.json({ success: true });
  } catch(e) { await testPool.end().catch(()=>{}); res.json({ success: false, error: e.message }); }
});
 
app.post('/api/db/setup', async (req, res) => {
  try {
    const fs   = require('fs');
    const sql  = fs.readFileSync(path.join(__dirname,'scripts/schema.sql'),'utf8');
    const stmts = sql.split(/;\s*\n/).filter(s => s.trim());
    for (const stmt of stmts) {
      if (stmt.trim()) await getPool().query(stmt).catch(e => console.log('Schema stmt skipped:', e.message));
    }
    res.json({ success: true });
  } catch(e) { res.json({ success: false, error: e.message }); }
});
 
// ── Routes ────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/exchange',    require('./routes/exchange'));
app.use('/api/sales',       require('./routes/sales'));
app.use('/api/purchase',    require('./routes/purchase'));
app.use('/api/customers',   require('./routes/customers'));
app.use('/api/rates',       require('./routes/rates'));
app.use('/api/stock',       require('./routes/stock'));
app.use('/api/reports',     require('./routes/reports'));
app.use('/api/touch',       require('./routes/touch'));
app.use('/api/processing',  require('./routes/processing'));
app.use('/api/cash-entries',require('./routes/cash_entries'));
app.use('/api/gold-entries',require('./routes/gold_entries'));
app.use('/api/expenses',    require('./routes/expenses'));
app.use('/api/pure-tokens', require('./routes/pure_tokens'));
app.use('/api/bank-entries', require('./routes/banktransfer'));


 
// ── Static (production) ───────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname,'../client/dist')));
  app.get('*', (_req,res) => res.sendFile(path.join(__dirname,'../client/dist/index.html')));
}
 
app.listen(PORT, () => console.log(`Gold Refinery PG server on :${PORT}`));
 