// src/pages/ProcessingReport.jsx
import React, { useState, useEffect } from 'react';
import { processingAPI } from '../db/api';
import { fmtDate } from '../db/utils';

export default function ProcessingReport() {
  const [records, setRecords]         = useState([]);
  const [unprocessed, setUnprocessed] = useState([]);
  const [selected, setSelected]       = useState([]);
  const [form, setForm]               = useState({
    process_date: new Date().toISOString().split('T')[0],
    output_pure_wt: '', output_touch: '99.90',
    processing_charges: '', chemical_cost: '', other_cost: '', remarks: ''
  });
  const [msg, setMsg]             = useState(null);
  const [activeTab, setActiveTab] = useState('new');
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recs, unp] = await Promise.all([processingAPI.getAll(), processingAPI.getUnprocessed()]);
      setRecords(recs); setUnprocessed(unp);
    } catch(e) { setMsg({type:'danger', text: e.message}); }
    setLoading(false);
  };

  const toggleSelect = (idx) => setSelected(prev => prev.includes(idx) ? prev.filter(i=>i!==idx) : [...prev, idx]);
  const selectedItems = selected.map(idx => unprocessed[idx]).filter(Boolean);
  const totalInputWt  = selectedItems.reduce((s,i) => s + (parseFloat(i.gross_wt)||0), 0);
  const totalPureWt   = selectedItems.reduce((s,i) => s + (parseFloat(i.pure_wt)||0), 0);
  const totalCost     = (parseFloat(form.processing_charges)||0) + (parseFloat(form.chemical_cost)||0) + (parseFloat(form.other_cost)||0);
  const outputPure    = parseFloat(form.output_pure_wt) || 0;
  const lossWt        = parseFloat((totalPureWt - outputPure).toFixed(3));
  const lossPct       = totalPureWt > 0 ? ((lossWt / totalPureWt) * 100).toFixed(2) : 0;

  // Warn if output looks like it was entered in mg instead of grams
  const outputLooksWrong = outputPure > 0 && outputPure > 9999;
  const outputFarTooHigh = outputPure > 0 && totalPureWt > 0 && outputPure > totalPureWt * 5;

  const handleSave = async () => {
    if (!selectedItems.length) { setMsg({type:'danger', text:'Select at least one gold batch'}); return; }
    if (!form.output_pure_wt)  { setMsg({type:'danger', text:'Enter output pure weight in GRAMS (e.g. 39.250)'}); return; }

    // Client-side validation before sending to server
    if (outputPure > 9999) {
      setMsg({type:'danger', text:`${outputPure}g is too large! Enter weight in GRAMS (e.g. 39.250), not milligrams (39250).`});
      return;
    }
    if (outputPure <= 0) {
      setMsg({type:'danger', text:'Output Pure Weight must be greater than 0'}); return;
    }
    if (outputFarTooHigh) {
      setMsg({type:'danger', text:`Output ${outputPure}g is much larger than input ${totalPureWt.toFixed(3)}g. Please check the value.`}); return;
    }

    setSaving(true); setMsg(null);
    try {
      const result = await processingAPI.create(form, selectedItems);
      setMsg({type:'success', text:`Processing batch ${result.process_no} saved! Output: ${outputPure}g → 99.90 touch`});
      setSelected([]);
      setForm({process_date:new Date().toISOString().split('T')[0], output_pure_wt:'', output_touch:'99.90', processing_charges:'', chemical_cost:'', other_cost:'', remarks:''});
      await loadData();
      setTimeout(() => setMsg(null), 4000);
    } catch(e) { setMsg({type:'danger', text: e.message}); }
    setSaving(false);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">PROCESSING</div>
        <div className="btn-group">
          <button className={`btn ${activeTab==='new'?'btn-primary':'btn-secondary'}`} onClick={()=>setActiveTab('new')}>New Batch</button>
          <button className={`btn ${activeTab==='history'?'btn-primary':'btn-secondary'}`} onClick={()=>setActiveTab('history')}>History</button>
        </div>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {activeTab==='new' && (
        <>
          <div className="card">
            <div className="card-title">Gold Available for Processing ({unprocessed.length} batches)</div>
            {loading ? <p className="text-muted">Loading...</p> : unprocessed.length===0 ? (
              <div className="empty-state"><div className="empty-icon">⚙</div><p>No gold available. Create exchange or purchase vouchers first.</p></div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th style={{width:40}}>
                        <input type="checkbox"
                          onChange={e => setSelected(e.target.checked ? unprocessed.map((_,i)=>i) : [])}
                          checked={selected.length===unprocessed.length && unprocessed.length>0}/>
                      </th>
                      <th>Source</th><th>Voucher No</th><th>Date</th><th>Customer</th>
                      <th className="right">Gross Wt (g)</th>
                      <th className="right">Pure Wt (g)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unprocessed.map((item,idx) => (
                      <tr key={idx} style={{cursor:'pointer'}} onClick={()=>toggleSelect(idx)}>
                        <td><input type="checkbox" checked={selected.includes(idx)} onChange={()=>toggleSelect(idx)} onClick={e=>e.stopPropagation()}/></td>
                        <td><span className={`badge ${item.source_type==='exchange'?'badge-info':'badge-warning'}`}>{item.source_type}</span></td>
                        <td className="font-mono text-gold">{item.source_voucher_no}</td>
                        <td style={{fontSize:12}}>{fmtDate(item.voucher_date)}</td>
                        <td>{item.customer_name}</td>
                        <td className="right td-number">{parseFloat(item.gross_wt||0).toFixed(3)}</td>
                        <td className="right td-number">{parseFloat(item.pure_wt||0).toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {selected.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={5} style={{fontWeight:600}}>Selected {selected.length} batches</td>
                        <td className="right">{totalInputWt.toFixed(3)}</td>
                        <td className="right">{totalPureWt.toFixed(3)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>

          {selected.length > 0 && (
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
              <div className="card">
                <div className="card-title">Processing Details</div>
                <div className="form-grid form-grid-2">
                  <div className="form-group">
                    <label>Process Date</label>
                    <input type="date" value={form.process_date} onChange={e=>setForm(f=>({...f,process_date:e.target.value}))}/>
                  </div>
                  <div className="form-group">
                    <label>Output Touch %</label>
                    <input type="number" step="0.01" value={form.output_touch} onChange={e=>setForm(f=>({...f,output_touch:e.target.value}))} className="highlight"/>
                  </div>
                </div>

                {/* KEY FIELD - Output Pure Weight with clear guidance */}
                <div className="form-group" style={{marginBottom:4}}>
                  <label style={{display:'flex', justifyContent:'space-between'}}>
                    <span>Output Pure Weight (grams) *</span>
                    <span style={{fontSize:11, color:'var(--text-muted)', fontWeight:400}}>
                      Input was: <strong style={{color:'var(--gold-dark)'}}>{totalPureWt.toFixed(3)} g</strong>
                    </span>
                  </label>
                  <input
                    type="number" step="0.001" min="0.001" max="9999"
                    placeholder={`e.g. ${(totalPureWt * 0.98).toFixed(3)}`}
                    value={form.output_pure_wt}
                    onChange={e => setForm(f=>({...f, output_pure_wt:e.target.value}))}
                    className="highlight"
                    style={{borderColor: outputLooksWrong ? 'var(--red)' : undefined}}
                  />
                </div>
                {/* Live warning if value looks wrong */}
                {outputLooksWrong && (
                  <div style={{background:'#FFF3CD', border:'1px solid #FFC107', borderRadius:4, padding:'8px 12px', marginBottom:12, fontSize:13}}>
                    ⚠ <strong>{outputPure}g looks too large.</strong> Enter weight in <strong>grams</strong> (e.g. <strong>{(outputPure/1000).toFixed(3)}</strong>), not milligrams.
                  </div>
                )}
                {outputFarTooHigh && !outputLooksWrong && (
                  <div style={{background:'#FFF3CD', border:'1px solid #FFC107', borderRadius:4, padding:'8px 12px', marginBottom:12, fontSize:13}}>
                    ⚠ Output <strong>{outputPure}g</strong> is more than input <strong>{totalPureWt.toFixed(3)}g</strong>. Please verify.
                  </div>
                )}

                <hr className="divider"/>
                <div className="form-grid form-grid-3">
                  <div className="form-group">
                    <label>Processing Charges (Rs.)</label>
                    <input type="number" step="0.01" placeholder="0.00" value={form.processing_charges} onChange={e=>setForm(f=>({...f,processing_charges:e.target.value}))}/>
                  </div>
                  <div className="form-group">
                    <label>Chemical Cost (Rs.)</label>
                    <input type="number" step="0.01" placeholder="0.00" value={form.chemical_cost} onChange={e=>setForm(f=>({...f,chemical_cost:e.target.value}))}/>
                  </div>
                  <div className="form-group">
                    <label>Other Cost (Rs.)</label>
                    <input type="number" step="0.01" placeholder="0.00" value={form.other_cost} onChange={e=>setForm(f=>({...f,other_cost:e.target.value}))}/>
                  </div>
                </div>
                <div className="form-group">
                  <label>Remarks</label>
                  <textarea rows={2} placeholder="Batch notes..." value={form.remarks} onChange={e=>setForm(f=>({...f,remarks:e.target.value}))}/>
                </div>
              </div>

              <div className="card">
                <div className="card-title">Processing Summary</div>
                <div className="calc-box">
                  <div className="calc-row">
                    <span className="calc-label">Total Input Wt</span>
                    <span className="calc-value">{totalInputWt.toFixed(3)} g</span>
                  </div>
                  <div className="calc-row">
                    <span className="calc-label">Total Pure Wt In</span>
                    <span className="calc-value">{totalPureWt.toFixed(3)} g</span>
                  </div>
                  <div className="calc-row">
                    <span className="calc-label">Output Pure Wt</span>
                    <span className={`calc-value ${outputPure > 0 ? 'text-green' : ''}`}>
                      {outputPure > 0 ? `${outputPure} g` : '--'}
                    </span>
                  </div>
                  <div className="calc-row">
                    <span className="calc-label">Processing Loss</span>
                    <span className={`calc-value ${lossWt > 0 ? 'text-red' : lossWt < 0 ? 'text-green' : ''}`}>
                      {outputPure > 0 && !outputLooksWrong ? `${lossWt.toFixed(3)}g (${lossPct}%)` : '--'}
                    </span>
                  </div>
                  <div className="calc-row total">
                    <span className="calc-label">Total Cost</span>
                    <span className="calc-value">Rs.{totalCost.toFixed(2)}</span>
                  </div>
                </div>

                <div style={{marginTop:12, padding:'10px 12px', background:'#F8F4EE', border:'1px solid var(--border-gold)', borderRadius:4, fontSize:12, color:'var(--text-muted)'}}>
                  <strong>Important:</strong> Enter Output Pure Weight in <strong>grams</strong>.<br/>
                  Example: if output is 39 grams 250 mg → enter <strong>39.250</strong>
                </div>

                <button
                  className="btn btn-primary"
                  style={{width:'100%', marginTop:16}}
                  onClick={handleSave}
                  disabled={saving || outputLooksWrong}
                >
                  {saving ? 'Saving...' : 'Complete Processing Batch'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab==='history' && (
        <div className="card">
          <div className="card-title">Processing History ({records.length} batches)</div>
          {loading ? <p className="text-muted">Loading...</p> : records.length===0 ? (
            <div className="empty-state"><div className="empty-icon">⚙</div><p>No processing records yet</p></div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Process No</th><th>Date</th>
                    <th className="right">Input Wt (g)</th>
                    <th className="right">Pure In (g)</th>
                    <th className="right">Output (g)</th>
                    <th className="right">Loss (g)</th>
                    <th className="right">Loss %</th>
                    <th className="right">Cost (Rs.)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id}>
                      <td className="font-mono text-gold">{r.process_no}</td>
                      <td>{fmtDate(r.process_date)}</td>
                      <td className="right td-number">{parseFloat(r.total_input_wt||0).toFixed(3)}</td>
                      <td className="right td-number">{parseFloat(r.total_input_pure_wt||0).toFixed(3)}</td>
                      <td className="right td-number text-green">{parseFloat(r.output_pure_wt||0).toFixed(3)}</td>
                      <td className="right" style={{color:parseFloat(r.loss_wt)>0?'var(--red)':'var(--green)'}}>
                        {parseFloat(r.loss_wt||0).toFixed(3)}
                      </td>
                      <td className="right" style={{color:parseFloat(r.loss_pct)>2?'var(--red)':'var(--text-light)'}}>
                        {r.loss_pct}%
                      </td>
                      <td className="right">Rs.{parseFloat(r.total_cost||0).toFixed(2)}</td>
                      <td><span className="badge badge-success">{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>{records.length} batches</td>
                    <td className="right">{records.reduce((s,r)=>s+parseFloat(r.total_input_wt||0),0).toFixed(3)}</td>
                    <td className="right">{records.reduce((s,r)=>s+parseFloat(r.total_input_pure_wt||0),0).toFixed(3)}</td>
                    <td className="right">{records.reduce((s,r)=>s+parseFloat(r.output_pure_wt||0),0).toFixed(3)}</td>
                    <td className="right">{records.reduce((s,r)=>s+parseFloat(r.loss_wt||0),0).toFixed(3)}</td>
                    <td></td>
                    <td className="right">Rs.{records.reduce((s,r)=>s+parseFloat(r.total_cost||0),0).toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
