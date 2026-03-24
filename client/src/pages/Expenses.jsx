// client/src/pages/Expenses.jsx
import React, { useState, useEffect } from 'react';
import { expenseAPI } from '../db/api';
import { fmtDate } from '../db/utils';

const TYPES = [
  { value:'expense',      label:'Expense' },
  { value:'advance_cash', label:'Advance Cash Given' },
  { value:'advance_gold', label:'Advance Gold Given' },
];

export default function Expenses() {
  const today = new Date().toISOString().split('T')[0];
  const [form,setForm]=useState({entry_date:today,expense_type:'expense',description:'',amount:'',gold_wt:'',remarks:''});
  const [list,setList]=useState([]); const [msg,setMsg]=useState(null); const [saving,setSaving]=useState(false);

  useEffect(()=>{ load(); },[]);
  const load=()=>expenseAPI.getAll().then(setList).catch(()=>{});
  const upForm=(k,v)=>setForm(f=>({...f,[k]:v}));
  const monoStyle={fontFamily:'JetBrains Mono, monospace',fontWeight:600};

  const totalCash = list.filter(r=>r.expense_type!=='advance_gold').reduce((s,r)=>s+(parseFloat(r.amount)||0),0);
  const totalGold = list.filter(r=>r.expense_type==='advance_gold').reduce((s,r)=>s+(parseFloat(r.gold_wt)||0),0);

  const handleSave=async()=>{
    if(!form.description){setMsg({type:'danger',text:'Description required'});return;}
    const isGold=form.expense_type==='advance_gold';
    if(isGold&&(!form.gold_wt||parseFloat(form.gold_wt)<=0)){setMsg({type:'danger',text:'Gold weight required'});return;}
    if(!isGold&&(!form.amount||parseFloat(form.amount)<=0)){setMsg({type:'danger',text:'Amount required'});return;}
    setSaving(true);setMsg(null);
    try{
      const r=await expenseAPI.create(form);
      setMsg({type:'success',text:`Expense ${r.entry_no} saved!`});
      setForm({entry_date:today,expense_type:'expense',description:'',amount:'',gold_wt:'',remarks:''});
      load();
    }catch(e){setMsg({type:'danger',text:e.message});}
    setSaving(false);
  };

  const handleDelete=async id=>{
    if(!window.confirm('Delete this expense?'))return;
    await expenseAPI.delete(id).catch(()=>{});
    load();
  };

  const isGoldType = form.expense_type==='advance_gold';

  return (
    <div className="page">
      <div className="page-header"><div className="page-title">EXPENSES</div></div>
      {msg&&<div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="two-col" style={{marginBottom:0}}>
        <div className="stat-card">
          <div className="stat-icon">₹</div>
          <div className="stat-value" style={{...monoStyle}}>₹{totalCash.toLocaleString('en-IN')}</div>
          <div className="stat-label">Total Cash Expenses</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⬡</div>
          <div className="stat-value" style={{...monoStyle,color:'var(--gold-dark)'}}>{totalGold.toFixed(3)}g</div>
          <div className="stat-label">Total Gold Advances</div>
        </div>
      </div>

      <div className="card" style={{marginTop:14}}>
        <div className="card-title">Add Expense</div>
        <div className="form-grid form-grid-3" style={{marginBottom:12}}>
          <div className="form-group"><label>Date</label>
            <input type="date" value={form.entry_date} onChange={e=>upForm('entry_date',e.target.value)}/></div>
          <div className="form-group"><label>Type</label>
            <select value={form.expense_type} onChange={e=>upForm('expense_type',e.target.value)}>
              {TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
            </select></div>
          <div className="form-group"><label>Description *</label>
            <input type="text" value={form.description} onChange={e=>upForm('description',e.target.value)} placeholder="Description..."/></div>
          {!isGoldType&&<div className="form-group"><label>Amount (₹)</label>
            <input type="number" step="0.01" min="0" value={form.amount} onChange={e=>upForm('amount',e.target.value)} className="highlight"/></div>}
          {isGoldType&&<div className="form-group"><label>Gold Weight (g)</label>
            <input type="number" step="0.001" min="0" value={form.gold_wt} onChange={e=>upForm('gold_wt',e.target.value)} className="highlight"/></div>}
          <div className="form-group"><label>Remarks</label>
            <input type="text" value={form.remarks} onChange={e=>upForm('remarks',e.target.value)}/></div>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'Saving...':'✦ Save Expense'}</button>
      </div>

      <div className="card">
        <div className="card-title">Expense List</div>
        {list.length===0?<div className="empty-state"><div className="empty-icon">₹</div><p>No expenses yet</p></div>:(
          <div className="table-container"><table>
            <thead><tr><th>Date</th><th>Entry No</th><th>Type</th><th>Description</th><th className="right">Amount (₹)</th><th className="right">Gold (g)</th><th>Remarks</th><th></th></tr></thead>
            <tbody>{list.map((r,i)=>(
              <tr key={i}>
                <td style={{fontSize:12}}>{fmtDate(r.entry_date)}</td>
                <td className="font-mono text-gold" style={{fontSize:12}}>{r.entry_no}</td>
                <td><span className="badge badge-warning">{TYPES.find(t=>t.value===r.expense_type)?.label||r.expense_type}</span></td>
                <td>{r.description}</td>
                <td className="right td-number">{parseFloat(r.amount||0)>0?`₹${parseFloat(r.amount).toLocaleString('en-IN',{minimumFractionDigits:2})}`:'—'}</td>
                <td className="right td-number" style={{color:'var(--gold-dark)'}}>{parseFloat(r.gold_wt||0)>0?parseFloat(r.gold_wt).toFixed(3):'—'}</td>
                <td style={{fontSize:12,color:'var(--text-muted)'}}>{r.remarks||'—'}</td>
                <td><button className="btn btn-danger btn-xs" onClick={()=>handleDelete(r.id)}>✕</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
