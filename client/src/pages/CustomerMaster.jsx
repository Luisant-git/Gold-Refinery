// src/pages/CustomerMaster.jsx
import React, { useState, useEffect } from 'react';
import { customerAPI } from '../db/api';
import { fmtDate } from '../db/utils';

const EMPTY = { mobile:'', name:'', address:'', city:'', id_proof_type:'', id_proof_no:'', opening_balance:'', balance_type:'DR', ob_cash:'', ob_gold:'', ob_exchange_gold:'', ob_exchange_cash:'' };

export default function CustomerMaster() {
  const [customers, setCustomers] = useState([]);
  const [form, setForm]           = useState({...EMPTY});
  const [editId, setEditId]       = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch]       = useState('');
  const [msg, setMsg]             = useState(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);

  useEffect(()=>{ load(); },[]);

  const load = async () => {
    setLoading(true);
    try { setCustomers(await customerAPI.getAll()); }
    catch(e) { setMsg({type:'danger',text:e.message}); }
    setLoading(false);
  };

  const filtered = customers.filter(c=>
    !search||c.name?.toLowerCase().includes(search.toLowerCase())||c.mobile?.includes(search)||c.city?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async () => {
    if(!form.mobile||!form.name){ setMsg({type:'danger',text:'Mobile and name required'}); return; }
    setSaving(true);
    try {
      if(editId) await customerAPI.update(editId, form);
      else       await customerAPI.create(form);
      setMsg({type:'success', text: editId ? 'Customer updated' : 'Customer added'});
      await load();
      setShowModal(false);
      setForm({...EMPTY});
      setEditId(null);
      setTimeout(()=>setMsg(null), 3000);
    } catch(e) { setMsg({type:'danger', text:e.message}); }
    setSaving(false);
  };

  const handleEdit = (c) => {
    setForm({ mobile:c.mobile, name:c.name, address:c.address||'', city:c.city||'',
      id_proof_type:c.id_proof_type||'', id_proof_no:c.id_proof_no||'',
      opening_balance:c.opening_balance||'', balance_type:c.balance_type||'DR', ob_cash:c.ob_cash||'', ob_gold:c.ob_gold||'', ob_exchange_gold:c.ob_exchange_gold||'', ob_exchange_cash:c.ob_exchange_cash||'' });
    setEditId(c.id); setShowModal(true); setMsg(null);
  };

  const handleDelete = async (id) => {
    if(!window.confirm('Deactivate this customer?')) return;
    try { await customerAPI.delete(id); await load(); }
    catch(e) { setMsg({type:'danger',text:e.message}); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">CUSTOMER MASTER</div>
          <div style={{fontSize:12,color:'var(--text-muted)',marginTop:1}}>{customers.length} customers registered</div>
        </div>
        <button className="btn btn-primary" onClick={()=>{ setForm({...EMPTY}); setEditId(null); setMsg(null); setShowModal(true); }}>+ Add Customer</button>
      </div>

      {msg && !showModal && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card">
        <div className="filter-bar" style={{marginBottom:12}}>
          <div className="form-group" style={{flex:1}}>
            <label>Search</label>
            <input type="text" placeholder="Search by name, mobile, city..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <div className="form-group" style={{paddingTop:20}}>
            <button className="btn btn-secondary" onClick={load}>Refresh</button>
          </div>
        </div>
        {loading ? <p className="text-muted">Loading customers...</p> : filtered.length===0 ? (
          <div className="empty-state"><div className="empty-icon">👤</div><p>No customers found</p></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Name</th><th>Mobile</th><th>City</th><th>ID Proof</th>
                  <th className="right">Opening Bal.</th><th>Added</th><th className="center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c,idx)=>(
                  <tr key={c.id}>
                    <td className="text-muted" style={{fontSize:12}}>{idx+1}</td>
                    <td><strong>{c.name}</strong></td>
                    <td className="font-mono">{c.mobile}</td>
                    <td>{c.city||'--'}</td>
                    <td style={{fontSize:12}}>{c.id_proof_type ? `${c.id_proof_type}: ${c.id_proof_no}` : '--'}</td>
                    <td className="right">{c.opening_balance ? <span style={{color:c.balance_type==='CR'?'var(--green)':'var(--text-light)'}}>{parseFloat(c.opening_balance).toFixed(3)}g {c.balance_type}</span> : '--'}</td>
                    <td style={{fontSize:12}}>{fmtDate(c.created_at)}</td>
                    <td className="center">
                      <div className="btn-group" style={{justifyContent:'center'}}>
                        <button className="btn btn-secondary btn-xs" onClick={()=>handleEdit(c)}>Edit</button>
                        <button className="btn btn-danger btn-xs" onClick={()=>handleDelete(c.id)}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setShowModal(false); }}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editId?'Edit Customer':'Add New Customer'}</div>
              <button className="modal-close" onClick={()=>setShowModal(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-grid form-grid-2">
                <div className="form-group"><label>Mobile *</label><input type="tel" placeholder="Mobile..." value={form.mobile} onChange={e=>setForm(f=>({...f,mobile:e.target.value}))} maxLength={15}/></div>
                <div className="form-group"><label>Full Name *</label><input type="text" placeholder="Name..." value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
                <div className="form-group full-width"><label>Address</label><textarea rows={2} placeholder="Address..." value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))}/></div>
                <div className="form-group"><label>City</label><input type="text" placeholder="City..." value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))}/></div>
                <div className="form-group"><label>ID Proof Type</label>
                  <select value={form.id_proof_type} onChange={e=>setForm(f=>({...f,id_proof_type:e.target.value}))}>
                    <option value="">Select...</option>
                    <option value="Aadhaar">Aadhaar Card</option>
                    <option value="PAN">PAN Card</option>
                    <option value="Passport">Passport</option>
                    <option value="DL">Driving License</option>
                    <option value="Voter">Voter ID</option>
                  </select>
                </div>
                <div className="form-group"><label>ID Proof No.</label><input type="text" placeholder="ID number..." value={form.id_proof_no} onChange={e=>setForm(f=>({...f,id_proof_no:e.target.value}))}/></div>
                <div className="form-group"><label>Opening Balance (g pure)</label><input type="number" step="0.001" placeholder="0.000" value={form.opening_balance} onChange={e=>setForm(f=>({...f,opening_balance:e.target.value}))}/></div>
                <div className="form-group"><label>OB Cash (₹)</label><input type="number" step="0.01" placeholder="0.00" value={form.ob_cash} onChange={e=>setForm(f=>({...f,ob_cash:e.target.value}))}/></div>
                <div className="form-group"><label>OB Gold (g)</label><input type="number" step="0.001" placeholder="0.000" value={form.ob_gold} onChange={e=>setForm(f=>({...f,ob_gold:e.target.value}))}/></div>
                <div className="form-group"><label>Exchange OB Gold (g)</label><input type="number" step="0.001" placeholder="0.000" value={form.ob_exchange_gold} onChange={e=>setForm(f=>({...f,ob_exchange_gold:e.target.value}))}/></div>
                <div className="form-group"><label>Exchange OB Cash (₹)</label><input type="number" step="0.01" placeholder="0.00" value={form.ob_exchange_cash} onChange={e=>setForm(f=>({...f,ob_exchange_cash:e.target.value}))}/></div>
                <div className="form-group"><label>Balance Type</label>
                  <select value={form.balance_type} onChange={e=>setForm(f=>({...f,balance_type:e.target.value}))}>
                    <option value="DR">DR (Customer owes us)</option>
                    <option value="CR">CR (We owe customer)</option>
                  </select>
                </div>
              </div>
              {msg && <div className={`alert alert-${msg.type}`} style={{marginTop:12}}>{msg.text}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving?'Saving...':editId?'Update':'Add Customer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
