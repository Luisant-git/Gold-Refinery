// client/src/pages/Settings.jsx — PostgreSQL version
import React, { useState, useEffect } from 'react';
import { dbStatus, testConn, runSetup, fixObSkipped } from '../db/api';

export default function Settings() {
  const [form, setForm] = useState({
    host:'localhost', port:'5432', database:'gold_refinery',
    user:'postgres', password:'postgres',
  });
  const [status,  setStatus]  = useState(null);
  const [msg,     setMsg]     = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { dbStatus().then(s => setStatus(s.connected)); }, []);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const testConnection = async () => {
    setLoading(true); setMsg(null);
    const r = await testConn(form);
    setMsg(r.success ? { type:'success', text:'✓ Connection successful!' } : { type:'danger', text:r.error });
    if (r.success) setStatus(true);
    setLoading(false);
  };

  const createTables = async () => {
    setLoading(true); setMsg(null);
    const r = await runSetup();
    setMsg(r.success ? { type:'success', text:'✓ All tables created / verified successfully' } : { type:'danger', text:r.error });
    setLoading(false);
  };

  const runFixObSkipped = async () => {
    setLoading(true); setMsg(null);
    const r = await fixObSkipped();
    setMsg(r.success ? { type:'success', text:`✓ ${r.message}` } : { type:'danger', text:r.error });
    setLoading(false);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <span className={'badge '+(status?'badge-success':'badge-danger')}>{status?'● Connected':'○ Offline'}</span>
      </div>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card">
        <div className="card-title">PostgreSQL Connection</div>
        <div className="form-grid form-grid-3" style={{ marginBottom:16 }}>
          <div className="form-group"><label>Host</label>
            <input value={form.host} onChange={e=>set('host',e.target.value)} placeholder="localhost"/></div>
          <div className="form-group"><label>Port</label>
            <input value={form.port} onChange={e=>set('port',e.target.value)} placeholder="5432"/></div>
          <div className="form-group"><label>Database</label>
            <input value={form.database} onChange={e=>set('database',e.target.value)} placeholder="gold_refinery"/></div>
          <div className="form-group"><label>Username</label>
            <input value={form.user} onChange={e=>set('user',e.target.value)} placeholder="postgres"/></div>
          <div className="form-group"><label>Password</label>
            <input type="password" value={form.password} onChange={e=>set('password',e.target.value)} placeholder="••••••••"/></div>
        </div>
        <div className="btn-group">
          <button className="btn btn-secondary" onClick={testConnection} disabled={loading}>
            {loading?'Testing...':'Test Connection'}
          </button>
          <button className="btn btn-primary" onClick={createTables} disabled={loading||!status}>
            {loading?'Running...':'Create / Verify Tables'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Data Repair</div>
        <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:14, lineHeight:1.7 }}>
          If Exchange OB history shows wrong totals, run this to repair historical data.
        </p>
        <button className="btn btn-primary" onClick={runFixObSkipped} disabled={loading||!status}>
          {loading?'Running...':'🔧 Fix Exchange OB History'}
        </button>
      </div>

      <div className="card">
        <div className="card-title">Current Configuration</div>
        <div className="calc-box">
          <div className="calc-row"><span className="calc-label">Engine</span>    <span className="calc-value">PostgreSQL</span></div>
          <div className="calc-row"><span className="calc-label">Host</span>      <span className="calc-value">localhost</span></div>
          <div className="calc-row"><span className="calc-label">Port</span>      <span className="calc-value">5432</span></div>
          <div className="calc-row"><span className="calc-label">Database</span>  <span className="calc-value">gold_refinery</span></div>
          <div className="calc-row"><span className="calc-label">Username</span>  <span className="calc-value">postgres</span></div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Setup Instructions</div>
        <div style={{ lineHeight:2.2, fontSize:14, color:'var(--text-sub)' }}>
          <ol style={{ paddingLeft:20, marginTop:8 }}>
            <li>Install <strong>PostgreSQL</strong> from postgresql.org</li>
            <li>Open <strong>pgAdmin</strong> or psql and create the database:<br/>
              <code style={{ background:'#f5f5f5', padding:'2px 8px', borderRadius:4 }}>CREATE DATABASE gold_refinery;</code></li>
            <li>Update <strong>.env</strong> file with your credentials</li>
            <li>Run <strong>npm install</strong> then <strong>npm run dev</strong></li>
            <li>Click <strong>Create / Verify Tables</strong> above</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
