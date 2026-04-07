// client/src/pages/SalesVoucher.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { salesAPI, customerAPI, rateAPI, exchangeAPI } from '../db/api';
import PrintReceipt from '../components/PrintReceipt';
import { fetchCustomerOB } from '../db/utils';

// ── Reusable mobile autocomplete with keyboard nav ─────────────
function MobileAC({ value, onChange, onSelect, onEnter }) {
  const [sugg, setSugg]       = useState([]);
  const [open, setOpen]       = useState(false);
  const [idx,  setIdx]        = useState(-1);
  const ref     = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (idx >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-item]');
      if (items[idx]) items[idx].scrollIntoView({ block:'nearest' });
    }
  }, [idx]);

  const handleChange = async e => {
    const v = e.target.value; onChange(v); setIdx(-1);
    if (v.length >= 2) {
      const rows = await customerAPI.search(v).catch(() => []);
      setSugg(rows); setOpen(rows.length > 0);
    } else { setSugg([]); setOpen(false); }
  };

  const pick = row => {
    onChange(row.mobile); onSelect(row);
    setSugg([]); setOpen(false); setIdx(-1);
    // Focus first weight input after selection
    setTimeout(() => onEnter && onEnter(), 50);
  };

  const handleKeyDown = e => {
    if (!open || !sugg.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i+1, sugg.length-1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i-1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (idx >= 0) pick(sugg[idx]);
      else if (sugg.length === 1) pick(sugg[0]);
    }
    else if (e.key === 'Escape') { setOpen(false); setIdx(-1); }
  };

  const mono = { fontFamily:'JetBrains Mono, monospace', fontWeight:600 };

  return (
    <div style={{ position:'relative' }} ref={ref}>
      <input type="tel" value={value} onChange={handleChange} onKeyDown={handleKeyDown}
        maxLength={15} style={{ width:'100%' }} autoComplete="off" />
      {open && sugg.length > 0 && (
        <div ref={listRef} style={{
          position:'absolute', top:'100%', left:0, right:0, zIndex:999,
          background:'#fff', border:'1.5px solid var(--gold-accent)',
          borderRadius:6, boxShadow:'0 4px 18px rgba(100,70,0,0.15)',
          maxHeight:230, overflowY:'auto',
        }}>
          {sugg.map((c, i) => (
            <div key={c.id} data-item onClick={() => pick(c)}
              onMouseEnter={() => setIdx(i)} onMouseLeave={() => setIdx(-1)}
              style={{
                padding:'9px 14px', cursor:'pointer', fontSize:14,
                display:'flex', justifyContent:'space-between', alignItems:'center',
                borderBottom:'1px solid var(--border)',
                background: i === idx ? '#FBF7EE' : '#fff',
                borderLeft: i === idx ? '3px solid var(--gold-accent)' : '3px solid transparent',
              }}>
              <span><strong style={{ color:'var(--gold-dark)' }}>{c.mobile}</strong>
                <span style={{ color:'var(--text-sub)', marginLeft:8 }}>{c.name}</span></span>
              <span style={{ fontSize:11, color:'var(--text-muted)', display:'flex', gap:8 }}>
                {parseFloat(c.ob_gold||0) !== 0 && <span style={{ color:'var(--green)', ...mono }}>G:{parseFloat(c.ob_gold).toFixed(3)}g</span>}
                {parseFloat(c.ob_cash||0) !== 0 && <span style={{ color:'var(--blue)', ...mono }}>₹{parseFloat(c.ob_cash).toFixed(0)}</span>}
              </span>
            </div>
          ))}
          <div style={{ padding:'4px 10px', fontSize:10, color:'var(--text-muted)', background:'#FAFAF5', borderTop:'1px solid var(--border)' }}>
            ↑↓ navigate · Enter select · Esc close
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
const EMPTY = { token_no:'', weight:'', touch:'', amount:'' };

export default function SalesVoucher() {
  const navigate   = useNavigate();
  const today      = new Date().toISOString().split('T')[0];
  const firstWtRef = useRef(null);   // ref to first weight input for auto-focus
  const monoStyle  = { fontFamily:'JetBrains Mono, monospace', fontWeight:600 };

const [form, setForm] = useState({
  voucher_date: today,
  mobile:'',
  customer_name:'',
  customer_id:null,
  rate_per_gram:'',
  deductions:'',
  payment_mode:'cash',
  remarks:'',
  ob_gold: 0,
  ob_cash:0,
  ob_items:[],
  exchange_ob_gold: 0,
  exchange_ob_cash: 0,
  exchange_ob_items: [],
});
  const [items,      setItems]      = useState([{ ...EMPTY }]);
  const [lastSaved,  setLastSaved]  = useState(null);
  const [msg,        setMsg]        = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [latestRate, setLatestRate] = useState(null);

  useEffect(() => {
    rateAPI.getLatest()
      .then(r => { if (r) { setLatestRate(r); setForm(f => ({ ...f, rate_per_gram: r.rate_24k })); } })
      .catch(() => {});
  }, []);

  const upForm = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Select customer → fetch sales OB from history
const onMobileSelect = async (cust) => {
setForm(f => ({
  ...f,
  mobile: cust.mobile,
  customer_name: cust.name,
  customer_id: cust.id,
  ob_gold: Number(cust?.ob_gold || 0),
  ob_cash: Number(cust?.ob_cash || 0),
}));
  try {
    const salesOb = await fetchCustomerOB(cust.id);
    const exchangeOb = await exchangeAPI.getCustomerOB(cust.id);

    console.log('Sales OB response:', salesOb);
    console.log('Exchange OB response:', exchangeOb);

   setForm(f => ({
  ...f,
  mobile: cust.mobile,
  customer_name: cust.name,
  customer_id: cust.id,
  ob_gold: Number(cust?.ob_gold || 0),
  ob_cash: Number(cust?.ob_cash || salesOb?.ob_cash || 0),
  ob_items: Array.isArray(salesOb?.ob_items) ? salesOb.ob_items : [],
  exchange_ob_gold: Number(exchangeOb?.ob_gold || 0),
  exchange_ob_cash: Number(exchangeOb?.ob_cash || 0),
  exchange_ob_items: Array.isArray(exchangeOb?.ob_items) ? exchangeOb.ob_items : [],
}));
  } catch (err) {
    console.error('OB fetch failed:', err);
    setForm(f => ({
  ...f,
  mobile: cust.mobile,
  customer_name: cust.name,
  customer_id: cust.id,
  ob_gold: Number(cust?.ob_gold || 0),
  ob_cash: Number(cust?.ob_cash || 0),
  ob_items: [],
  exchange_ob_gold: 0,
  exchange_ob_cash: 0,
  exchange_ob_items: [],
}));
  }
};

  // Auto-focus first weight field after customer selection
  const focusFirstWt = () => {
    if (firstWtRef.current) firstWtRef.current.focus();
  };

  // Item calc: amount = weight × touch% / 100 × rate
  const upItem = (idx, field, value) => {
    setItems(prev => prev.map((row, i) => {
      if (i !== idx) return row;
      const u = { ...row, [field]: value };
      const wt   = parseFloat(field === 'weight' ? value : u.weight) || 0;
      const tch  = parseFloat(field === 'touch'  ? value : u.touch)  || 0;
      const rt   = parseFloat(form.rate_per_gram) || 0;
      u.amount = wt > 0 && tch > 0 && rt > 0
        ? parseFloat((wt * tch / 100 * rt).toFixed(2)) : '';
      return u;
    }));
  };

  // Recalc amounts when rate changes
  useEffect(() => {
    const rt = parseFloat(form.rate_per_gram) || 0;
    if (!rt) return;
    setItems(prev => prev.map(row => {
      const wt  = parseFloat(row.weight) || 0;
      const tch = parseFloat(row.touch)  || 0;
      return wt > 0 && tch > 0
        ? { ...row, amount: parseFloat((wt * tch / 100 * rt).toFixed(2)) } : row;
    }));
  }, [form.rate_per_gram]);

  // const totalAmt   = items.reduce((s,r) => s + (parseFloat(r.amount) || 0), 0);
  // const totalWt    = items.reduce((s,r) => s + (parseFloat(r.weight) || 0), 0);
  // const deductions = parseFloat(form.deductions) || 0;
  // const netAmount  = parseFloat((totalAmt - deductions).toFixed(2));
  // const obCash     = parseFloat(form.ob_cash) || 0;

  const totalAmt   = items.reduce((s,r) => s + (parseFloat(r.amount) || 0), 0);
const totalWt    = items.reduce((s,r) => s + (parseFloat(r.weight) || 0), 0);
const deductions = parseFloat(form.deductions) || 0;
const roundedTotalAmt = Math.floor(totalAmt / 10) * 10;
const rawNetAmount = totalAmt - deductions;
const netAmount = Math.floor(rawNetAmount / 10) * 10;

const obGold = parseFloat(form.ob_gold) || 0;
const obCash = parseFloat(form.ob_cash) || 0;
const exchangeObGold = parseFloat(form.exchange_ob_gold) || 0;
const exchangeObCash = parseFloat(form.exchange_ob_cash) || 0;

const totalGoldOb = obGold + exchangeObGold;
const totalCashOb = obCash + exchangeObCash;

  const handleSave = async () => {
    if (!form.mobile || !form.customer_name) { setMsg({ type:'danger', text:'Mobile and name required' }); return; }
    if (!form.rate_per_gram) { setMsg({ type:'danger', text:'Rate required' }); return; }
    const valid = items.filter(r => r.weight && r.touch);
    if (!valid.length) { setMsg({ type:'danger', text:'Add at least one item with Weight and Touch' }); return; }

    setSaving(true); setMsg(null);
    try {
      let custId = form.customer_id;
      if (!custId) {
        const res = await customerAPI.create({ mobile: form.mobile, name: form.customer_name, ob_gold:0, ob_cash:0 });
        custId = res.id;
      }
      // Map simplified items to API format
      const apiItems = valid.map(r => ({
        item_description: r.token_no || '',
        katcha_wt: r.weight, token_wt: 0,
        total_wt: r.weight, touch: r.touch,
        pure_wt: parseFloat(((parseFloat(r.weight)||0) * (parseFloat(r.touch)||0) / 100).toFixed(3)),
        amount: r.amount,
      }));
      const result = await salesAPI.create(
        { ...form, customer_id: custId, amount_paid: netAmount, gross_amount: roundedTotalAmt },
        apiItems
      );
      setMsg({ type:'success', text:`Sales Voucher ${result.voucher_no} saved! Net: ₹${netAmount.toLocaleString('en-IN')}` });
      const full = await salesAPI.getById(result.id).catch(() => null);
      setLastSaved(full);
      setTimeout(() => { handleClear(); setMsg(null); }, 8000);
    } catch(e) { setMsg({ type:'danger', text: e.message }); }
    setSaving(false);
  };

 const handleClear = () => {
  setLastSaved(null);
  setForm({
    voucher_date: today,
    mobile:'',
    customer_name:'',
    customer_id:null,
    rate_per_gram: latestRate?.rate_24k || '',
    deductions:'',
    payment_mode:'cash',
    remarks:'',
    ob_gold: 0,
    ob_cash:0,
    ob_items:[],
    exchange_ob_gold: 0,
    exchange_ob_cash: 0,
    exchange_ob_items: [],
  });
  setItems([{ ...EMPTY }]);
  setMsg(null);
};
  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">SALES VOUCHER</div>
        <div className="btn-group">
          <button className="btn btn-secondary" onClick={() => navigate('/vouchers')}>View All</button>
          <button className="btn btn-secondary" onClick={handleClear}>Clear</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : '✦ Save Voucher'}
          </button>
        </div>
      </div>

      {msg && msg.type !== 'success' && (
        <div className={`alert alert-${msg.type}`}>{msg.text}</div>
      )}

      {/* Top form */}
      <div className="card">
        <div className="form-grid form-grid-4">
          <div className="form-group">
            <label>Date</label>
            <input type="date" value={form.voucher_date} onChange={e => upForm('voucher_date', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Mobile *</label>
            <MobileAC value={form.mobile} onChange={v => upForm('mobile', v)}
              onSelect={onMobileSelect} onEnter={focusFirstWt} />
          </div>
          <div className="form-group">
            <label>Customer Name *</label>
            <input type="text" value={form.customer_name} onChange={e => upForm('customer_name', e.target.value)} />
          </div>
          <div className="form-group">
            <label>24K Rate (₹/gram)</label>
            <input type="number" step="0.01" value={form.rate_per_gram}
              onChange={e => upForm('rate_per_gram', e.target.value)} className="highlight" />
          </div>
        </div>

        {/* OB Banner — always show when customer selected */}
               {/* ── Opening Balance Summary ── */}
                {/* ── Opening Balance Summary ── */}
        {(form.customer_id ||
          obGold !== 0 ||
          obCash !== 0 ||
          exchangeObGold !== 0 ||
          exchangeObCash !== 0 ||
          (form.ob_items || []).length > 0 ||
          (form.exchange_ob_items || []).length > 0) && (
          <div style={{
            marginTop: 14,
            background: 'linear-gradient(90deg, #F7F4EC, #EFE7D6)',
            border: '1.5px solid rgba(120,100,60,0.18)',
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '10px 16px',
              borderBottom: '1px dashed rgba(120,100,60,0.18)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1,
              color: 'var(--text-muted)',
              textTransform: 'uppercase'
            }}>
              Opening Balance Summary
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 14,
              padding: '14px 16px'
            }}>
              {/* GOLD BLOCK */}
              <div style={{
                background: 'rgba(184,134,11,0.06)',
                border: '1px solid rgba(184,134,11,0.18)',
                borderRadius: 8,
                overflow: 'hidden'
              }}>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--gold-dark)',
                    marginBottom: 10,
                    textTransform: 'uppercase',
                    letterSpacing: 0.8
                  }}>
                    OB Gold
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Exchange OB Gold</span>
                    <strong style={{ fontFamily: 'JetBrains Mono, monospace', color: exchangeObGold > 0 ? 'var(--red)' : 'var(--gold-dark)' }}>
                      {exchangeObGold > 0 ? `−${exchangeObGold.toFixed(3)} g` : '0.000 g'}
                    </strong>
                  </div>
                </div>

                {(form.exchange_ob_items || []).length > 0 && (
                  <div style={{
                    borderTop: '1px dashed rgba(184,134,11,0.22)',
                    borderBottom: '1px dashed rgba(184,134,11,0.22)',
                    background: 'rgba(184,50,50,0.04)',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}>
                    {(form.exchange_ob_items || []).map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '6px 8px',
                          borderRadius: 5,
                          background: 'rgba(184,50,50,0.04)',
                          border: '1px solid rgba(184,50,50,0.14)',
                          fontSize: 12,
                          flexWrap: 'wrap'
                        }}
                      >
                        <strong style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 700,
                          fontSize: 14,
                          color: 'var(--red)',
                          minWidth: 90,
                        }}>
                          −{parseFloat(item.ob_amount || 0).toFixed(3)} g
                        </strong>

                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: 'rgba(184,50,50,0.12)',
                          color: 'var(--red)',
                        }}>
                          EXCHANGE OB
                        </span>

                        <span style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 600,
                          fontSize: 12,
                          color: 'var(--gold-dark)',
                        }}>
                          #{item.voucher_no}
                        </span>

                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {new Date(item.voucher_date).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    ))}

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px 0',
                      marginTop: 2,
                      borderTop: '1.5px solid rgba(184,50,50,0.22)',
                      fontSize: 13,
                    }}>
                      <span style={{
                        fontWeight: 700,
                        color: 'var(--red)',
                        letterSpacing: 0.5,
                      }}>
                        {(form.exchange_ob_items || []).length > 1
                          ? `TOTAL EXCHANGE OB (${(form.exchange_ob_items || []).length} vouchers)`
                          : 'TOTAL EXCHANGE OB'}
                      </span>
                      <strong style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 700,
                        fontSize: 15,
                        color: 'var(--red)',
                      }}>
                        −{exchangeObGold.toFixed(3)} g
                      </strong>
                    </div>
                  </div>
                )}

                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>General OB Gold</span>
                    <strong style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--gold-dark)' }}>
                      {obGold.toFixed(3)} g
                    </strong>
                  </div>

                  <div style={{
                    height: 1,
                    background: 'rgba(184,134,11,0.18)',
                    margin: '8px 0'
                  }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold-dark)' }}>
                      Total Gold OB
                    </span>
                    <strong style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 16,
                      color: 'var(--gold-dark)'
                    }}>
                      {totalGoldOb.toFixed(3)} g
                    </strong>
                  </div>
                </div>
              </div>

              {/* CASH BLOCK */}
              <div style={{
                background: 'rgba(26,80,128,0.06)',
                border: '1px solid rgba(26,80,128,0.18)',
                borderRadius: 8,
                overflow: 'hidden'
              }}>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--blue)',
                    marginBottom: 10,
                    textTransform: 'uppercase',
                    letterSpacing: 0.8
                  }}>
                    OB Cash
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sales OB Cash</span>
                    <strong style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--blue)' }}>
                      ₹{obCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Exchange OB Cash</span>
                    <strong style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--blue)' }}>
                      ₹{exchangeObCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>

                {(form.ob_items || []).length > 0 && (
                  <div style={{
                    borderTop: '1px dashed rgba(26,80,128,0.22)',
                    borderBottom: '1px dashed rgba(26,80,128,0.22)',
                    background: 'rgba(26,80,128,0.04)',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}>
                    {(form.ob_items || []).map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '6px 8px',
                          borderRadius: 5,
                          background: 'rgba(26,80,128,0.04)',
                          border: '1px solid rgba(26,80,128,0.14)',
                          fontSize: 12,
                          flexWrap: 'wrap'
                        }}
                      >
                        <strong style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 700,
                          fontSize: 14,
                          color: 'var(--red)',
                          minWidth: 90,
                        }}>
                          ₹{parseFloat(item.ob_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </strong>

                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: 'rgba(26,80,128,0.12)',
                          color: 'var(--blue)',
                        }}>
                          SALES OB
                        </span>

                        <span style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 600,
                          fontSize: 12,
                          color: 'var(--gold-dark)',
                        }}>
                          #{item.voucher_no}
                        </span>

                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {new Date(item.voucher_date).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    ))}

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px 0',
                      marginTop: 2,
                      borderTop: '1.5px solid rgba(26,80,128,0.22)',
                      fontSize: 13,
                    }}>
                      <span style={{
                        fontWeight: 700,
                        color: 'var(--blue)',
                        letterSpacing: 0.5,
                      }}>
                        {(form.ob_items || []).length > 1
                          ? `TOTAL SALES OB (${(form.ob_items || []).length} vouchers)`
                          : 'TOTAL SALES OB'}
                      </span>
                      <strong style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 700,
                        fontSize: 15,
                        color: 'var(--blue)',
                      }}>
                        ₹{obCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </div>
                )}

                <div style={{ padding: '12px 14px' }}>
                  <div style={{
                    height: 1,
                    background: 'rgba(26,80,128,0.18)',
                    margin: '8px 0'
                  }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)' }}>
                      Total Cash OB
                    </span>
                    <strong style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 16,
                      color: 'var(--blue)'
                    }}>
                      ₹{totalCashOb.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Items table — 5 columns only */}
      <div className="card">
        <div className="flex-between mb-12">
          <div className="card-title" style={{ marginBottom:0, borderBottom:'none', paddingBottom:0 }}>
            Gold Items Sold to Customer
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setItems(p => [...p, { ...EMPTY }])}>+ Add Row</button>
        </div>
        <div className="table-container">
          <table className="item-table">
            <thead>
              <tr>
                <th style={{ width:42 }}>S.No</th>
                <th style={{ width:120 }}>Token No</th>
                <th className="right" style={{ width:130 }}>Weight (g)</th>
                <th className="right" style={{ width:100 }}>Touch (%)</th>
                <th className="right" style={{ width:140 }}>Amount (₹)</th>
                <th style={{ width:36 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, idx) => (
                <tr key={idx}>
                  <td className="text-center text-muted" style={{ fontSize:12 }}>{idx+1}</td>
                  <td>
                    <input type="text" value={row.token_no}
                      onChange={e => upItem(idx, 'token_no', e.target.value)}
                      style={{ minWidth:100 }} />
                  </td>
                  <td>
                    <input type="number" step="0.001" min="0" value={row.weight}
                      ref={idx === 0 ? firstWtRef : null}
                      onChange={e => upItem(idx, 'weight', e.target.value)}
                      style={{ textAlign:'right', minWidth:100, ...monoStyle }} />
                  </td>
                  <td>
                    <input type="number" step="0.01" min="0" value={row.touch}
                      onChange={e => upItem(idx, 'touch', e.target.value)}
                      style={{ textAlign:'right', minWidth:80, ...monoStyle }} className="highlight" />
                  </td>
                  <td>
                    <input type="number" step="0.01" readOnly value={row.amount}
                      style={{ textAlign:'right', minWidth:110, ...monoStyle,
                        color:'var(--blue)', background:'#F0F5FA',
                        border:'none', borderBottom:'1.5px solid rgba(26,80,128,0.25)' }} />
                  </td>
                  <td>
                    <button className="btn btn-danger btn-xs"
                      onClick={() => { if (items.length > 1) setItems(p => p.filter((_,i) => i !== idx)); }}
                      disabled={items.length === 1}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} style={{ textAlign:'right', fontSize:11 }}>TOTAL</td>
                <td className="right">{totalWt > 0 ? totalWt.toFixed(3) : '—'}</td>
                <td></td>
              <td className="right" style={{ color:'var(--blue)' }}>
  {totalAmt > 0 ? `₹${roundedTotalAmt.toLocaleString('en-IN')}` : '—'}
</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Payment + Summary */}
      <div className="two-col">
        <div className="card">
          <div className="card-title">Payment Details</div>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label>Deductions (₹)</label>
              <input type="number" step="0.01" value={form.deductions} onChange={e => upForm('deductions', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Payment Mode</label>
              <select value={form.payment_mode} onChange={e => upForm('payment_mode', e.target.value)}>
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="upi">UPI</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>
          <div className="form-group" style={{ marginTop:8 }}>
            <label>Remarks</label>
            <textarea rows={2} value={form.remarks} onChange={e => upForm('remarks', e.target.value)} />
          </div>
        </div>

        <div className="card">
          <div className="card-title">Payment Summary</div>
          <div className="calc-box">
            <div className="calc-row">
              <span className="calc-label">Total Weight</span>
              <span className="calc-value">{totalWt.toFixed(3)} g</span>
            </div>
            <div className="calc-row">
              <span className="calc-label">Gross Amount</span>
             <span className="calc-value">₹{roundedTotalAmt.toLocaleString('en-IN')}</span>
            </div>
            {deductions > 0 && (
              <div className="calc-row">
                <span className="calc-label">Deductions</span>
                <span className="calc-value text-red">− ₹{deductions.toFixed(2)}</span>
              </div>
            )}
            {obCash > 0 && (
              <div className="calc-row">
                <span className="calc-label" style={{ color:'var(--red)' }}>Pending OB Cash</span>
                <span className="calc-value" style={{ color:'var(--red)' }}>₹{obCash.toLocaleString('en-IN', { minimumFractionDigits:2 })}</span>
              </div>
            )}
            <div className="calc-row total">
              <span className="calc-label">NET PAYABLE</span>
              <span className="calc-value big text-green">
                ₹{netAmount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop:4 }}>
        {msg?.type === 'success' && (
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            gap:12, padding:'12px 18px', marginBottom:8, borderRadius:7,
            background:'rgba(26,110,64,0.09)', border:'1.5px solid rgba(26,110,64,0.35)',
          }}>
            <span style={{ fontWeight:600, color:'var(--green)', fontSize:13 }}>✓ {msg.text}</span>
            {lastSaved && (
              <button onClick={() => setLastSaved(s => ({ ...s, _showPrint: true }))}
                style={{ background:'#6B4A00', color:'#FFF5D6', border:'none',
                  padding:'8px 20px', borderRadius:6, fontWeight:700, fontSize:13,
                  cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
                  display:'flex', alignItems:'center', gap:6 }}>
                🖨 Print Receipt
              </button>
            )}
          </div>
        )}
        <div className="btn-group" style={{ justifyContent:'flex-end' }}>
          <button className="btn btn-secondary" onClick={handleClear}>Clear</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : '✦ Save Sales Voucher'}
          </button>
        </div>
      </div>

      {lastSaved?._showPrint && (
        <PrintReceipt voucher={lastSaved} type="sales"
          onClose={() => setLastSaved(s => ({ ...s, _showPrint: false }))} />
      )}
    </div>
  );
}
