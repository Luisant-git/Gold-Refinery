// src/pages/TouchMaster.js
import React, { useState, useEffect } from 'react';
import { touchAPI } from '../db/api';

export default function TouchMaster() {
  const [items, setItems]   = useState([]);
  const [form, setForm]     = useState({ touch_name:'', touch_value:'', karat:'' });
  const [editId, setEditId] = useState(null);
  const [msg, setMsg]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(()=>{ load(); },[]);

  const load = async () => {
    setLoading(true);
    try{ setItems(await touchAPI.getAll()); }catch(e){ setMsg({type:'danger',text:e.message}); }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if(!form.touch_name||!form.touch_value){setMsg({type:'danger',text:'Name and value required'});return;}
    setSaving(true);
    try{
      if(editId) await touchAPI.update(editId,form);
      else       await touchAPI.create(form);
      await load();
      setMsg({type:'success',text:'Saved!'});
      setForm({touch_name:'',touch_value:'',karat:''});
      setEditId(null);
      setTimeout(()=>setMsg(null),2000);
    }catch(e){ setMsg({type:'danger',text:e.message}); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try{ await touchAPI.delete(id); await load(); }catch(e){ setMsg({type:'danger',text:e.message}); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">TOUCH STANDARDS</div>
      </div>
      {msg&&<div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:16}}>
        <div className="card">
          <div className="card-title">{editId?'Edit':'Add'} Standard</div>
          <div className="form-group" style={{marginBottom:12}}>
            <label>Touch Name</label>
            <input type="text" placeholder="e.g. 22K (91.60)" value={form.touch_name} onChange={e=>setForm(f=>({...f,touch_name:e.target.value}))}/>
          </div>
          <div className="form-group" style={{marginBottom:12}}>
            <label>Touch Value (%)</label>
            <input type="number" step="0.01" min="0" max="100" placeholder="e.g. 91.60" value={form.touch_value} onChange={e=>setForm(f=>({...f,touch_value:e.target.value}))} className="highlight"/>
          </div>
          <div className="form-group" style={{marginBottom:16}}>
            <label>Karat</label>
            <select value={form.karat} onChange={e=>setForm(f=>({...f,karat:e.target.value}))}>
              <option value="">Select...</option>
              {['24K','23K','22K','21K','20K','18K','16K','14K','9K'].map(k=><option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          {form.touch_value&&(
            <div className="touch-meter" style={{marginBottom:12}}>
              <div className="touch-fill" style={{width:`${Math.min(parseFloat(form.touch_value),100)}%`}}/>
            </div>
          )}
          <div className="btn-group">
            {editId&&<button className="btn btn-secondary" onClick={()=>{setForm({touch_name:'',touch_value:'',karat:''});setEditId(null);}}>Cancel</button>}
            <button className="btn btn-primary" style={{flex:1}} onClick={handleSubmit} disabled={saving}>
              {saving?'Saving...':editId?'Update':'Add'}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Touch Standards ({items.length})</div>
          {loading?<p className="text-muted">Loading...</p>:(
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th className="right">Value (%)</th>
                    <th>Karat</th>
                    <th>Visual</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length===0?<tr><td colSpan={5} className="text-center text-muted" style={{padding:20}}>No touch standards defined</td></tr>:
                  items.map(item=>(
                    <tr key={item.id}>
                      <td>{item.touch_name}</td>
                      <td className="right td-number">{item.touch_value}%</td>
                      <td><span className="badge badge-gold">{item.karat||'—'}</span></td>
                      <td style={{width:130}}>
                        <div className="touch-meter" style={{margin:0}}>
                          <div className="touch-fill" style={{width:`${Math.min(parseFloat(item.touch_value),100)}%`}}/>
                        </div>
                      </td>
                      <td>
                        <div className="btn-group">
                          <button className="btn btn-secondary btn-xs" onClick={()=>{setForm({touch_name:item.touch_name,touch_value:item.touch_value,karat:item.karat||''});setEditId(item.id);}}>Edit</button>
                          <button className="btn btn-danger btn-xs" onClick={()=>handleDelete(item.id)}>Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
