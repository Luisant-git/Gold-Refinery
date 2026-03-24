// src/pages/RateMaster.jsx
import React, { useState, useEffect } from 'react';
import { rateAPI } from '../db/api';
import { fmtDate, fmtDateTime } from '../db/utils';

export default function RateMaster() {
  const [rates, setRates] = useState([]);
  const [form, setForm]   = useState({ rate_date:new Date().toISOString().split('T')[0], rate_24k:'', rate_22k:'', rate_18k:'' });
  const [msg, setMsg]     = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(()=>{ load(); },[]);

  const load = async () => {
    try { setRates(await rateAPI.getAll()); }
    catch(e) { setMsg({type:'danger', text:e.message}); }
  };

  const handleSave = async () => {
    if(!form.rate_24k){ setMsg({type:'danger',text:'24K rate is required'}); return; }
    setSaving(true);
    try {
      await rateAPI.create(form);
      await load();
      setMsg({type:'success', text:`Rate saved: Rs.${form.rate_24k}/g for ${form.rate_date}`});
      setForm(f=>({...f, rate_24k:'', rate_22k:'', rate_18k:''}));
      setTimeout(()=>setMsg(null), 3000);
    } catch(e) { setMsg({type:'danger', text:e.message}); }
    setSaving(false);
  };

  const latest = rates[0];

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">GOLD RATE MASTER</div>
      </div>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
      <div style={{display:'grid', gridTemplateColumns:'1fr 2fr', gap:16}}>
        <div className="card">
          <div className="card-title">Add Today Rate</div>
          <div className="form-group" style={{marginBottom:12}}>
            <label>Date</label>
            <input type="date" value={form.rate_date} onChange={e=>setForm(f=>({...f,rate_date:e.target.value}))}/>
          </div>
          <div className="form-group" style={{marginBottom:12}}>
            <label>24K Rate (Rs./gram) *</label>
            <input type="number" step="0.01" placeholder="e.g. 6500" value={form.rate_24k} onChange={e=>setForm(f=>({...f,rate_24k:e.target.value}))} className="highlight"/>
          </div>
          <div className="form-group" style={{marginBottom:12}}>
            <label>22K Rate (Rs./gram)</label>
            <input type="number" step="0.01" placeholder={form.rate_24k?(parseFloat(form.rate_24k)*0.916).toFixed(2):'Auto'} value={form.rate_22k} onChange={e=>setForm(f=>({...f,rate_22k:e.target.value}))}/>
          </div>
          <div className="form-group" style={{marginBottom:16}}>
            <label>18K Rate (Rs./gram)</label>
            <input type="number" step="0.01" placeholder={form.rate_24k?(parseFloat(form.rate_24k)*0.75).toFixed(2):'Auto'} value={form.rate_18k} onChange={e=>setForm(f=>({...f,rate_18k:e.target.value}))}/>
          </div>
          {latest && (
            <div style={{padding:'10px 12px',background:'#F8F4EE',border:'1px solid var(--border-gold)',borderRadius:4,marginBottom:12}}>
              <div style={{fontSize:10,color:'var(--text-muted)',marginBottom:3}}>LAST ENTRY</div>
              <div style={{fontFamily:'Share Tech Mono',fontSize:20,color:'var(--gold-dark)'}}>Rs.{parseFloat(latest.rate_24k).toLocaleString('en-IN')}/g</div>
              <div style={{fontSize:11,color:'var(--text-muted)'}}>{fmtDate(latest.rate_date)}</div>
            </div>
          )}
          <button className="btn btn-primary" style={{width:'100%'}} onClick={handleSave} disabled={saving}>
            {saving?'Saving...':'Save Rate'}
          </button>
        </div>
        <div className="card">
          <div className="card-title">Rate History</div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="right">24K (Rs./g)</th>
                  <th className="right">22K (Rs./g)</th>
                  <th className="right">18K (Rs./g)</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {rates.length===0
                  ? <tr><td colSpan={5} className="text-center text-muted" style={{padding:20}}>No rates added yet</td></tr>
                  : rates.map(r=>(
                    <tr key={r.id}>
                      <td>{fmtDate(r.rate_date)}</td>
                      <td className="right td-number">Rs.{parseFloat(r.rate_24k).toLocaleString('en-IN')}</td>
                      <td className="right">{r.rate_22k?`Rs.${parseFloat(r.rate_22k).toLocaleString('en-IN')}`:'--'}</td>
                      <td className="right">{r.rate_18k?`Rs.${parseFloat(r.rate_18k).toLocaleString('en-IN')}`:'--'}</td>
                      <td style={{fontSize:12}}>{fmtDateTime(r.created_at)}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
