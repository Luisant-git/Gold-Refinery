// client/src/pages/ExchangeVoucher.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { exchangeAPI, customerAPI, rateAPI } from '../db/api';
import PrintReceipt from '../components/PrintReceipt';

const EMPTY_ROW = { token_no:'', katcha_wt:'', katcha_touch:'', less_touch:'', balance_touch:'', pure_wt:'' };

// ── Mobile autocomplete with keyboard navigation ──────────────
function MobileAutocomplete({ value, onChange, onSelect }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open,        setOpen]        = useState(false);
  const [activeIdx,   setActiveIdx]   = useState(-1);
  const ref     = useRef(null);
  const listRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleChange = async e => {
    const v = e.target.value;
    onChange(v);
    setActiveIdx(-1);
    if (v.length >= 2) {
      const rows = await customerAPI.search(v).catch(() => []);
      setSuggestions(rows);
      setOpen(rows.length > 0);
    } else { setSuggestions([]); setOpen(false); }
  };

  const pick = row => {
    onChange(row.mobile);
    onSelect(row);
    setSuggestions([]);
    setOpen(false);
    setActiveIdx(-1);
  };

  const handleKeyDown = e => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < suggestions.length) {
        pick(suggestions[activeIdx]);
      } else if (suggestions.length === 1) {
        // If only one match, Enter selects it directly
        pick(suggestions[0]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIdx(-1);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (activeIdx >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-item]');
      if (items[activeIdx]) {
        items[activeIdx].scrollIntoView({ block:'nearest' });
      }
    }
  }, [activeIdx]);

  return (
    <div style={{ position:'relative' }} ref={ref}>
      <input
        type="tel"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        maxLength={15}
        style={{ width:'100%' }}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div ref={listRef} style={{
          position:'absolute', top:'100%', left:0, right:0, zIndex:999,
          background:'#fff', border:'1.5px solid var(--gold-accent)',
          borderRadius:6, boxShadow:'0 4px 18px rgba(100,70,0,0.15)',
          maxHeight:240, overflowY:'auto',
        }}>
          {suggestions.map((c, idx) => (
            <div
              key={c.id}
              data-item
              onClick={() => pick(c)}
              style={{
                padding:'10px 14px', cursor:'pointer',
                borderBottom:'1px solid var(--border)',
                fontSize:14,
                display:'flex', justifyContent:'space-between', alignItems:'center',
                background: idx === activeIdx ? '#FBF7EE' : '#fff',
                borderLeft: idx === activeIdx ? '3px solid var(--gold-accent)' : '3px solid transparent',
              }}
              onMouseEnter={() => setActiveIdx(idx)}
              onMouseLeave={() => setActiveIdx(-1)}
            >
              <span>
                <strong style={{ color:'var(--gold-dark)' }}>{c.mobile}</strong>
                <span style={{ color:'var(--text-sub)', marginLeft:8 }}>{c.name}</span>
              </span>
              <span style={{ fontSize:11, color:'var(--text-muted)', display:'flex', gap:8 }}>
                {parseFloat(c.ob_exchange_gold||0) !== 0 &&
                  <span style={{ color:'var(--green)', fontFamily:'JetBrains Mono,monospace', fontWeight:600 }}>
                    EX-G: {parseFloat(c.ob_exchange_gold).toFixed(3)}g
                  </span>}
                {parseFloat(c.ob_exchange_cash||0) !== 0 &&
                  <span style={{ color:'var(--blue)', fontFamily:'JetBrains Mono,monospace', fontWeight:600 }}>
                    EX-₹: {parseFloat(c.ob_exchange_cash).toFixed(2)}
                  </span>}
              </span>
            </div>
          ))}
          <div style={{ padding:'5px 10px', fontSize:11, color:'var(--text-muted)', borderTop:'1px solid var(--border)', background:'#FAFAF5' }}>
            ↑↓ navigate &nbsp;·&nbsp; Enter to select &nbsp;·&nbsp; Esc to close
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function ExchangeVoucher() {
  const navigate = useNavigate();
  const today    = new Date().toISOString().split('T')[0];

  const [voucherNo,  setVoucherNo]  = useState('Loading...');
  const [lastSaved,  setLastSaved]  = useState(null);  // full saved voucher for print
  const [form, setForm] = useState({
    voucher_date: today,
    mobile:'', customer_name:'', customer_id:null,
    rate_per_gram:'', pure_touch:'99.90', remarks:'',
    ob_exchange_gold: 0,
    ob_exchange_cash: 0,
    ob_items:         [],
    ob_last_voucher:  null,
    ob_last_date:     null,
    ob_tx_type:       null,
  });
  const [items,      setItems]      = useState([{ ...EMPTY_ROW }]);
  const [settle,     setSettle]     = useState({ cash_gold:'', use_ob:true, cash_given:'' });
  const [msg,        setMsg]        = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [latestRate, setLatestRate] = useState(null);

  // On mount: load latest rate AND pre-fetch next voucher number
  useEffect(() => {
    rateAPI.getLatest()
      .then(r => { if (r) { setLatestRate(r); setForm(f=>({...f, rate_per_gram:r.rate_24k})); } })
      .catch(()=>{});
    exchangeAPI.getNextNo()
      .then(no => setVoucherNo(no))
      .catch(()=> setVoucherNo('—'));
  }, []);

  const upForm = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Called when user selects a customer from dropdown
  const onMobileSelect = async cust => {
    setForm(f => ({
      ...f,
      customer_name:    cust.name,
      customer_id:      cust.id,
      ob_exchange_gold: parseFloat(cust.ob_exchange_gold) || 0,
      ob_exchange_cash: parseFloat(cust.ob_exchange_cash) || 0,
    }));

    try {
      const ob = await exchangeAPI.getCustomerOB(cust.id);
      if (ob.success && ob.has_history) {
        setForm(f => ({
          ...f,
          ob_exchange_gold: ob.ob_gold,
          ob_exchange_cash: ob.ob_cash,
          ob_items:         ob.ob_items || [],
        }));
      }
    } catch(e) {}
  };

  // Item calc: balance_touch = katcha_touch − less_touch; pure_wt = katcha_wt × balance_touch ÷ 100
  const upItem = (idx, field, value) => {
    setItems(prev => prev.map((row, i) => {
      if (i !== idx) return row;
      const u  = { ...row, [field]: value };
      const kt = parseFloat(field === 'katcha_touch' ? value : u.katcha_touch) || 0;
      const lt = parseFloat(field === 'less_touch'   ? value : u.less_touch)   || 0;
      u.balance_touch = kt > 0 ? parseFloat((kt - lt).toFixed(2)) : '';
      const kw = parseFloat(field === 'katcha_wt' ? value : u.katcha_wt) || 0;
      const bt = parseFloat(u.balance_touch) || 0;
      u.pure_wt = kw > 0 && bt > 0 ? parseFloat((kw * bt / 100).toFixed(3)) : '';
      return u;
    }));
  };

  // ── Computed values ──────────────────────────────────────────
  const totalKatcha    = items.reduce((s,r) => s + (parseFloat(r.katcha_wt) || 0), 0);
  const totalPureRaw   = items.reduce((s,r) => s + (parseFloat(r.pure_wt)   || 0), 0);
  const pureTouchVal   = parseFloat(form.pure_touch) || 99.90;
  const actualPureGold = parseFloat((totalPureRaw * pureTouchVal / 100).toFixed(3));

  const obGold      = parseFloat(form.ob_exchange_gold) || 0;
  const obCash      = parseFloat(form.ob_exchange_cash) || 0;
  const useOB       = settle.use_ob && obGold > 0;         // only deduct if toggled on AND has OB
  const obApplied   = useOB ? obGold : 0;                  // actual OB being used this transaction
  const netPureOwed = parseFloat((actualPureGold - obApplied).toFixed(3));
  const rate        = parseFloat(form.rate_per_gram) || 0;

  const cashGold        = parseFloat(settle.cash_gold) || 0;
  const cashGiven       = parseFloat(settle.cash_given) || 0;
  const diff            = parseFloat((cashGold - netPureOwed).toFixed(3));
  const cashForPurchase = diff < 0 && rate > 0 ? parseFloat((Math.abs(diff) * rate).toFixed(2)) : 0;
  const cashRounded     = Math.round(cashForPurchase);
  const cashBalance     = parseFloat((cashRounded - cashGiven).toFixed(2));

  // Purchase is NIL if cash given covers the remaining gold value (within ₹1 tolerance)
  const purchaseCashSettled = diff < -0.001 && cashGiven > 0
    && cashGiven >= cashForPurchase * 0.99;

  const isNil      = settle.cash_gold !== '' && (Math.abs(diff) < 0.001 || purchaseCashSettled);
  const isSales    = settle.cash_gold !== '' && diff >  0.001;
  const isPurchase = settle.cash_gold !== '' && diff < -0.001 && !purchaseCashSettled;

  const monoStyle = { fontFamily:'JetBrains Mono, monospace', fontWeight:600 };

  // ── Save ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.mobile)        { setMsg({ type:'danger', text:'Mobile required' }); return; }
    if (!form.customer_name) { setMsg({ type:'danger', text:'Customer name required' }); return; }
    if (!form.rate_per_gram) { setMsg({ type:'danger', text:'Rate per gram required' }); return; }
    const valid = items.filter(r => r.katcha_wt && r.balance_touch);
    if (!valid.length) { setMsg({ type:'danger', text:'Add at least one row with Katcha Weight and Touch' }); return; }

    setSaving(true); setMsg(null);
    try {
      let custId = form.customer_id;
      if (!custId) {
        const res = await customerAPI.create({
          mobile: form.mobile, name: form.customer_name,
          ob_exchange_gold:0, ob_exchange_cash:0, ob_gold:0, ob_cash:0,
        });
        custId = res.id;
      }
      const vData = {
        ...form,
        customer_id:        custId,
        pure_gold_given:    cashGold,
        cash_for_remaining: cashGiven > 0 ? cashGiven : cashRounded,
        total_pure_wt:      netPureOwed,
        actual_pure_gold:   actualPureGold,
        transaction_type:   (isNil || purchaseCashSettled) ? 'nil' : isSales ? 'sales' : 'purchase',
        diff_gold:          diff,
        ob_applied:         obApplied,
        ob_skipped:         useOB ? 0 : obGold,
      };
      const result = await exchangeAPI.create(vData, valid);
      // Fetch full voucher for print
      const full = await exchangeAPI.getById(result.id).catch(() => null);
      setLastSaved(full);
      setVoucherNo(result.voucher_no);
      setMsg({ type:'success', text:`Exchange Voucher #${result.voucher_no} saved!` });
      setTimeout(() => { handleClear(); setMsg(null); }, 8000);
    } catch(e) { setMsg({ type:'danger', text:e.message }); }
    setSaving(false);
  };

  const handleClear = () => {
    setLastSaved(null);
    setForm({
      voucher_date: today, mobile:'', customer_name:'', customer_id:null,
      rate_per_gram: latestRate?.rate_24k || '', pure_touch:'99.90', remarks:'',
      ob_exchange_gold:0, ob_exchange_cash:0, ob_items:[],
      ob_last_voucher:null, ob_last_date:null, ob_tx_type:null,
    });
    setItems([{ ...EMPTY_ROW }]);
    setSettle({ cash_gold:'', use_ob:true, cash_given:'' });
    setMsg(null);
    // Refresh next voucher number
    exchangeAPI.getNextNo().then(no => setVoucherNo(no)).catch(()=>{});
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="page">

      {/* ── Header ── */}
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div className="page-title">EXCHANGE VOUCHER</div>
          {/* Bill number shown prominently */}
          <div style={{
            fontFamily:'JetBrains Mono, monospace', fontWeight:700,
            fontSize:17, color:'var(--gold-dark)',
            background:'var(--bg-card2)',
            border:'1.5px solid var(--border-focus)',
            borderRadius:6, padding:'4px 14px',
            letterSpacing:2,
          }}>
            #{voucherNo}
          </div>
        </div>
        <div className="btn-group">
          <button className="btn btn-secondary" onClick={() => navigate('/vouchers')}>View All</button>
          <button className="btn btn-secondary" onClick={handleClear}>Clear</button>
          <button className="btn btn-primary"   onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : '✦ Save Voucher'}
          </button>
        </div>
      </div>

      {msg && msg.type !== 'success' && (
        <div className={`alert alert-${msg.type}`}>{msg.text}</div>
      )}

      {/* ── Top form ── */}
      <div className="card">
        <div className="form-grid form-grid-4">
          <div className="form-group">
            <label>Date</label>
            <input type="date" value={form.voucher_date}
              onChange={e => upForm('voucher_date', e.target.value)} />
          </div>

          <div className="form-group">
            <label>Mobile *</label>
            <MobileAutocomplete
              value={form.mobile}
              onChange={v => upForm('mobile', v)}
              onSelect={onMobileSelect}
            />
          </div>

          <div className="form-group">
            <label>Customer Name *</label>
            <input type="text" value={form.customer_name}
              onChange={e => upForm('customer_name', e.target.value)} />
          </div>

          <div className="form-group">
            <label>24K Rate (₹/gram)</label>
            <input type="number" step="0.01" value={form.rate_per_gram}
              onChange={e => upForm('rate_per_gram', e.target.value)}
              className="highlight" />
          </div>
        </div>

        {/* ── Exchange OB — always show when customer is selected ── */}
        {form.customer_id && (
          <div style={{
            marginTop: 14,
            background: 'linear-gradient(90deg, #F5F0E6, #EEE8D8)',
            border: '1.5px solid rgba(184,134,11,0.3)',
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            {/* Header row — total OB + OB Cash */}
            <div style={{
              padding: '10px 16px',
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              borderBottom: (form.ob_items||[]).length > 0 ? '1px dashed rgba(184,134,11,0.3)' : 'none',
            }}>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:1, color:'var(--text-muted)', textTransform:'uppercase', marginRight:6 }}>
                Opening Balance
              </div>

              {/* Total Sales OB Gold */}
              <div style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'5px 14px', borderRadius:6,
                background: obGold > 0 ? 'rgba(184,50,50,0.08)' : 'rgba(0,0,0,0.04)',
                border: `1.5px solid ${obGold > 0 ? 'rgba(184,50,50,0.3)' : 'rgba(0,0,0,0.1)'}`,
              }}>
                <span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:0.5 }}>OB GOLD</span>
                <strong style={{
                  fontFamily:'JetBrains Mono, monospace', fontWeight:700, fontSize:17,
                  color: obGold > 0 ? 'var(--red)' : 'var(--text-muted)',
                }}>
                  {obGold === 0 ? '0.000 g' : `−${obGold.toFixed(3)} g`}
                </strong>
                {obGold > 0 && (
                  <span style={{ fontSize:10, color:'var(--red)', fontWeight:700, background:'rgba(184,50,50,0.1)', padding:'2px 6px', borderRadius:4 }}>
                    SALES OB — DEDUCTED
                  </span>
                )}
                {(form.ob_items||[]).length > 1 && obGold > 0 && (
                  <span style={{ fontSize:10, color:'var(--text-muted)', fontStyle:'italic' }}>
                    (from {(form.ob_items||[]).length} vouchers)
                  </span>
                )}
              </div>

              {/* OB Cash */}
              <div style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'5px 14px', borderRadius:6,
                background: obCash !== 0 ? 'rgba(26,80,128,0.08)' : 'rgba(0,0,0,0.04)',
                border: `1.5px solid ${obCash !== 0 ? 'rgba(26,80,128,0.3)' : 'rgba(0,0,0,0.1)'}`,
              }}>
                <span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:0.5 }}>OB CASH</span>
                <strong style={{
                  fontFamily:'JetBrains Mono, monospace', fontWeight:700, fontSize:17,
                  color: obCash !== 0 ? 'var(--blue)' : 'var(--text-muted)',
                }}>
                  {obCash === 0 ? '₹0.00' : `₹${Math.abs(obCash).toLocaleString('en-IN', { minimumFractionDigits:2 })}`}
                </strong>
              </div>

              {obGold === 0 && obCash === 0 && (
                <span style={{ fontSize:12, color:'var(--text-muted)', fontStyle:'italic' }}>No previous Sales OB</span>
              )}
            </div>

            {/* Individual Sales OB voucher breakdown */}
            {(form.ob_items||[]).length > 0 && (
              <div style={{ padding:'8px 16px', display:'flex', flexDirection:'column', gap:5 }}>
                {(form.ob_items||[]).map((item, idx) => (
                  <div key={idx} style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'5px 10px', borderRadius:5,
                    background: 'rgba(184,50,50,0.04)',
                    border: '1px solid rgba(184,50,50,0.18)',
                    fontSize:12,
                  }}>
                    {/* Amount */}
                    <strong style={{
                      fontFamily:'JetBrains Mono, monospace', fontWeight:700, fontSize:14,
                      color: 'var(--red)', minWidth: 90,
                    }}>
                      −{item.ob_amount.toFixed(3)} g
                    </strong>

                    {/* Label badge */}
                    <span style={{
                      fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:4,
                      background: 'rgba(184,50,50,0.12)', color: 'var(--red)',
                    }}>
                      SALES OB
                    </span>

                    {/* Separator */}
                    <span style={{ color:'var(--text-dim)', fontSize:11 }}>—</span>

                    {/* Voucher number */}
                    <span style={{
                      fontFamily:'JetBrains Mono, monospace', fontWeight:600, fontSize:12,
                      color:'var(--gold-dark)',
                    }}>
                      #{item.voucher_no}
                    </span>

                    {/* Date */}
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>
                      {new Date(item.voucher_date).toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric' })}
                    </span>
                  </div>
                ))}

                {/* Total Sales OB line when multiple vouchers */}
                {(form.ob_items||[]).length > 1 && (
                  <div style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'6px 10px', marginTop:2,
                    borderTop:'1.5px solid rgba(184,50,50,0.25)',
                    fontSize:13,
                  }}>
                    <span style={{ fontWeight:700, color:'var(--red)', letterSpacing:0.5 }}>
                      TOTAL SALES OB ({(form.ob_items||[]).length} vouchers)
                    </span>
                    <strong style={{
                      fontFamily:'JetBrains Mono, monospace', fontWeight:700, fontSize:16,
                      color: 'var(--red)',
                    }}>
                      −{obGold.toFixed(3)} g
                    </strong>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Items table ── */}
      <div className="card">
        <div className="flex-between mb-12">
          <div className="card-title" style={{ marginBottom:0, borderBottom:'none', paddingBottom:0 }}>
            Gold Items Received
          </div>
          <button className="btn btn-secondary btn-sm"
            onClick={() => setItems(p => [...p, { ...EMPTY_ROW }])}>
            + Add Row
          </button>
        </div>

        <div className="table-container">
          <table className="item-table">
            <thead>
              <tr>
                <th style={{ width:42 }}>S.No</th>
                <th style={{ width:110 }}>Token No</th>
                <th className="right" style={{ width:120 }}>Katcha Wt (g)</th>
                <th className="right" style={{ width:110 }}>Katcha Touch</th>
                <th className="right" style={{ width:100 }}>Less Touch</th>
                <th className="right" style={{ width:120 }}>Balance Touch</th>
                <th className="right" style={{ width:120 }}>Pure Wt (g)</th>
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
                      style={{ minWidth:90 }} />
                  </td>
                  <td>
                    <input type="number" step="0.001" min="0" value={row.katcha_wt}
                      onChange={e => upItem(idx, 'katcha_wt', e.target.value)}
                      style={{ textAlign:'right', minWidth:96, ...monoStyle }} />
                  </td>
                  <td>
                    <input type="number" step="0.01" min="0" max="100" value={row.katcha_touch}
                      onChange={e => upItem(idx, 'katcha_touch', e.target.value)}
                      style={{ textAlign:'right', minWidth:88, ...monoStyle }}
                      className="highlight" />
                  </td>
                  <td>
                    <input type="number" step="0.01" min="0" value={row.less_touch}
                      onChange={e => upItem(idx, 'less_touch', e.target.value)}
                      style={{ textAlign:'right', minWidth:80, ...monoStyle }} />
                  </td>
                  <td>
                    <input type="number" step="0.01" readOnly value={row.balance_touch}
                      style={{
                        textAlign:'right', minWidth:96, ...monoStyle,
                        color:'var(--gold-dark)', background:'#F5F1E6',
                        border:'none', borderBottom:'1.5px solid var(--border)',
                      }} />
                  </td>
                  <td>
                    <input type="number" step="0.001" readOnly value={row.pure_wt}
                      style={{
                        textAlign:'right', minWidth:96, ...monoStyle,
                        color:'var(--green)', background:'#F0FAF4',
                        border:'none', borderBottom:'1.5px solid rgba(26,110,64,0.3)',
                      }} />
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
                <td colSpan={2} style={{ textAlign:'right', fontSize:11, letterSpacing:1 }}>TOTAL</td>
                <td className="right">{totalKatcha > 0 ? totalKatcha.toFixed(3) : '—'}</td>
                <td colSpan={3}></td>
                <td className="right" style={{ color:'var(--green)' }}>
                  {totalPureRaw > 0 ? totalPureRaw.toFixed(3) : '—'}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Row-by-row formula hint */}
        {items.some(r => r.balance_touch && r.katcha_wt) && (
          <div style={{
            marginTop:10, padding:'7px 12px',
            background:'#FAFAF0', border:'1px solid var(--border)',
            borderRadius:4, fontSize:12, color:'var(--text-muted)', lineHeight:2.2,
          }}>
            {items.filter(r => r.katcha_wt && r.balance_touch).map((r, i) => (
              <span key={i} style={{ marginRight:20 }}>
                Row {i+1}:{' '}
                <strong style={{ color:'var(--gold-dark)' }}>
                  {parseFloat(r.katcha_wt).toFixed(3)}g × {r.balance_touch}% ÷ 100
                </strong>
                {' = '}
                <strong style={{ color:'var(--green)' }}>
                  {parseFloat(r.pure_wt||0).toFixed(3)}g
                </strong>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Settlement + Summary ── */}
      <div className="two-col">

        {/* Settlement */}
        <div className="card">
          <div className="card-title">Settlement</div>

          {/* ── Pure Touch row ── */}
          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
            <label style={{ textTransform:'none', fontSize:13, fontWeight:600, color:'var(--text-sub)', whiteSpace:'nowrap' }}>
              Pure Touch
            </label>
            <input type="number" step="0.01" value={form.pure_touch}
              onChange={e => upForm('pure_touch', e.target.value)}
              style={{ width:90, ...monoStyle, textAlign:'right' }}
              className="highlight" />
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>%</span>
          </div>

          {/* ── TOTAL PURE GOLD — step-by-step display ── */}
          <div style={{
            background: 'linear-gradient(135deg, #F8F3E6, #F2EAD5)',
            border: '2px solid rgba(184,134,11,0.35)',
            borderRadius: 8,
            marginBottom: 14,
            overflow: 'hidden',
          }}>

            {/* Row 1 — Total Pure Gold (before OB) */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 18px',
              borderBottom: obGold !== 0 ? '1px dashed rgba(184,134,11,0.3)' : 'none',
            }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:1.2, color:'var(--text-muted)', textTransform:'uppercase', marginBottom:3 }}>
                  Total Pure Gold
                </div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                  {totalPureRaw.toFixed(3)}g × {pureTouchVal}% ÷ 100
                </div>
              </div>
              <div style={{ ...monoStyle, fontSize:26, color:'var(--gold-dark)', lineHeight:1, textAlign:'right' }}>
                {actualPureGold.toFixed(3)}
                <span style={{ fontSize:13, marginLeft:4, fontWeight:400, color:'var(--text-muted)' }}>g</span>
              </div>
            </div>

            {/* Row 2 — Sales OB deduction breakdown (one sub-row per voucher) */}
            {obGold > 0 && (
              <div style={{
                borderBottom: '1px dashed rgba(184,134,11,0.3)',
                background: 'rgba(184,50,50,0.04)',
              }}>
                {/* Individual Sales OB voucher rows */}
                {(form.ob_items||[]).map((item, idx) => (
                  <div key={idx} style={{
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    padding: idx === 0 ? '10px 18px 5px' : '4px 18px',
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flex:1 }}>
                      <span style={{
                        fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:4, flexShrink:0,
                        background:'rgba(184,50,50,0.12)', color:'var(--red)',
                      }}>
                        SALES OB
                      </span>
                      <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:11, color:'var(--gold-dark)', fontWeight:600 }}>
                        #{item.voucher_no}
                      </span>
                      <span style={{ fontSize:11, color:'var(--text-muted)' }}>
                        {new Date(item.voucher_date).toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric' })}
                      </span>
                    </div>
                    <span style={{ fontFamily:'JetBrains Mono, monospace', fontWeight:700, fontSize:14, color:'var(--red)' }}>
                      −{item.ob_amount.toFixed(3)} g
                    </span>
                  </div>
                ))}

                {/* Total Sales OB */}
                <div style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding: (form.ob_items||[]).length > 1 ? '6px 18px 10px' : '0 18px 10px',
                  marginTop: (form.ob_items||[]).length > 1 ? 4 : 0,
                  borderTop: (form.ob_items||[]).length > 1 ? '1px solid rgba(184,50,50,0.2)' : 'none',
                }}>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, letterSpacing:1, textTransform:'uppercase', color:'var(--red)' }}>
                      {(form.ob_items||[]).length > 1
                        ? `Total Sales OB Deduction (${(form.ob_items||[]).length} vouchers)`
                        : 'Sales OB Deduction'}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                      Extra gold given previously — deducted from owed now
                    </div>
                  </div>
                  <div style={{ fontFamily:'JetBrains Mono, monospace', fontWeight:700, fontSize:20, lineHeight:1, color:'var(--red)' }}>
                    −{obGold.toFixed(3)}
                    <span style={{ fontSize:13, marginLeft:4, fontWeight:400, color:'var(--text-muted)' }}>g</span>
                  </div>
                </div>
              </div>
            )}

            {/* Row 3 — Net Pure Gold Due (after OB) + Quick Fill button */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 18px',
              background: 'rgba(184,134,11,0.06)',
            }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:1.2, color:'var(--gold-dark)', textTransform:'uppercase', marginBottom:3 }}>
                  {obApplied !== 0 ? 'Net Pure Gold Due' : 'Total Pure Gold Due'}
                </div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                  {obApplied !== 0
                    ? `${actualPureGold.toFixed(3)}g − ${obApplied.toFixed(3)}g OB`
                    : `After ${pureTouchVal}% pure touch`}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ ...monoStyle, fontSize:30, color:'var(--gold-dark)', lineHeight:1, textAlign:'right' }}>
                  {netPureOwed.toFixed(3)}
                  <span style={{ fontSize:14, marginLeft:4, fontWeight:400, color:'var(--text-muted)' }}>g</span>
                </div>
                <button
                  onClick={() => setSettle(s => ({ ...s, cash_gold: netPureOwed.toFixed(3) }))}
                  style={{
                    background:'var(--gold-dark)', color:'#FFF5D6',
                    border:'none', borderRadius:6, padding:'8px 12px',
                    fontFamily:'Inter,sans-serif', fontWeight:600, fontSize:11,
                    cursor:'pointer', whiteSpace:'nowrap', flexShrink:0, lineHeight:1.4,
                  }}
                >Use ↓</button>
              </div>
            </div>

            {/* OB Toggle — skip OB deduction for this transaction */}
            {obGold > 0 && (
              <div style={{
                padding:'10px 18px',
                borderTop: '1px dashed rgba(184,134,11,0.3)',
                background: settle.use_ob ? 'rgba(184,50,50,0.04)' : 'rgba(26,110,64,0.05)',
                display:'flex', alignItems:'center', justifyContent:'space-between', gap:10,
              }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color: settle.use_ob ? 'var(--red)' : 'var(--green)' }}>
                    {settle.use_ob
                      ? `✓ Sales OB −${obGold.toFixed(3)}g deducted this transaction`
                      : `⏭ Sales OB ${obGold.toFixed(3)}g skipped — carry to next transaction`}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                    {settle.use_ob
                      ? 'Customer agreed to deduct previous Sales OB now'
                      : 'Customer said: deduct next time'}
                  </div>
                </div>
                <button
                  onClick={() => setSettle(s => ({ ...s, use_ob: !s.use_ob, cash_gold:'' }))}
                  style={{
                    padding:'7px 14px', borderRadius:6, flexShrink:0,
                    fontFamily:'Inter,sans-serif', fontWeight:700, fontSize:11,
                    cursor:'pointer', border:'1.5px solid',
                    background: settle.use_ob ? '#fff' : 'rgba(26,110,64,0.08)',
                    borderColor: settle.use_ob ? 'rgba(184,50,50,0.4)' : 'rgba(26,110,64,0.4)',
                    color: settle.use_ob ? 'var(--red)' : 'var(--green)',
                  }}
                >
                  {settle.use_ob ? 'Skip OB →' : '← Apply OB'}
                </button>
              </div>
            )}

          </div>

          {/* ── Pure Gold Given input ── */}
          <div className="form-group" style={{ marginBottom: settle.cash_gold !== '' ? 10 : 14 }}>
            <label>Pure Gold Given to Customer (g)</label>
            <input
              type="number" step="0.001" min="0"
              value={settle.cash_gold}
              onChange={e => setSettle(s => ({ ...s, cash_gold:e.target.value }))}
              className="highlight"
              style={{ ...monoStyle, fontSize:16 }}
              placeholder={`Owed: ${netPureOwed.toFixed(3)}g`}
            />
          </div>

          {/* ── Transaction result ── */}
          {settle.cash_gold !== '' && (
            <div style={{
              borderRadius: 7, marginBottom: 12, overflow: 'hidden',
              border: `1.5px solid ${isNil ? 'rgba(26,110,64,0.3)' : isSales ? 'rgba(26,80,128,0.3)' : 'rgba(184,134,11,0.4)'}`,
            }}>
              <div style={{
                padding: '9px 14px',
                background: isNil ? 'rgba(26,110,64,0.1)' : isSales ? 'rgba(26,80,128,0.1)' : 'rgba(184,134,11,0.1)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize:18 }}>{isNil ? '✓' : isSales ? '📤' : '📥'}</span>
                <strong style={{ fontSize:14, fontWeight:700, color: isNil ? 'var(--green)' : isSales ? 'var(--blue)' : 'var(--gold-dark)' }}>
                  {isNil ? 'Transaction NIL — Balanced' : isSales ? 'SALES — Extra Gold Given' : 'PURCHASE — Less Gold Given'}
                </strong>
              </div>

              <div style={{ padding:'10px 14px', background:'#fff', display:'flex', flexDirection:'column', gap:6 }}>
                {isNil && (
                  <div style={{ fontSize:13, color:'var(--text-muted)' }}>
                    {purchaseCashSettled
                      ? <>Gold given: <strong style={{ ...monoStyle, color:'var(--gold-dark)' }}>{cashGold.toFixed(3)}g</strong> + Cash: <strong style={{ ...monoStyle, color:'var(--green)' }}>₹{cashGiven.toLocaleString('en-IN')}</strong> — Fully settled. No OB carried forward.</>
                      : <>Customer receives exactly <strong style={{ ...monoStyle, color:'var(--green)' }}>{cashGold.toFixed(3)}g</strong>. No balance pending.</>
                    }
                  </div>
                )}

                {isSales && (
                  <>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                      <span style={{ color:'var(--text-muted)' }}>Gold owed to customer</span>
                      <span style={{ ...monoStyle }}>{netPureOwed.toFixed(3)} g</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                      <span style={{ color:'var(--text-muted)' }}>Gold given</span>
                      <span style={{ ...monoStyle, color:'var(--blue)' }}>{cashGold.toFixed(3)} g</span>
                    </div>
                    <div style={{ height:1, background:'var(--border)', margin:'2px 0' }} />
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:14 }}>
                      <span style={{ fontWeight:600, color:'var(--blue)' }}>Extra gold (→ Sales OB)</span>
                      <span style={{ ...monoStyle, fontWeight:700, color:'var(--blue)', fontSize:15 }}>+{diff.toFixed(3)} g</span>
                    </div>
                  </>
                )}

                {isPurchase && (
                  <>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                      <span style={{ color:'var(--text-muted)' }}>Gold owed to customer</span>
                      <span style={{ ...monoStyle }}>{netPureOwed.toFixed(3)} g</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                      <span style={{ color:'var(--text-muted)' }}>Gold given</span>
                      <span style={{ ...monoStyle }}>{cashGold.toFixed(3)} g</span>
                    </div>
                    <div style={{ height:1, background:'var(--border)', margin:'2px 0' }} />
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                      <span style={{ color:'var(--text-muted)' }}>Pending gold</span>
                      <span style={{ ...monoStyle, color:'var(--red)' }}>{Math.abs(diff).toFixed(3)} g</span>
                    </div>
                    {rate > 0 && (
                      <>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                          <span style={{ color:'var(--text-muted)' }}>@ ₹{rate}/g</span>
                          <span style={{ ...monoStyle }}>₹{cashForPurchase.toFixed(2)}</span>
                        </div>
                        <div style={{ height:1, background:'var(--border)', margin:'2px 0' }} />
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ fontWeight:600, color:'var(--gold-dark)', fontSize:13 }}>Cash to pay (rounded)</span>
                          <span style={{ ...monoStyle, fontWeight:700, color:'var(--gold-dark)', fontSize:20 }}>
                            ₹{cashRounded.toLocaleString('en-IN')}
                          </span>
                        </div>

                        {/* ── Cash Given by Owner ── */}
                        <div style={{ height:1, background:'var(--border)', margin:'6px 0' }} />
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <span style={{ fontWeight:600, color:'var(--text-sub)', fontSize:13, whiteSpace:'nowrap' }}>
                            Cash Given to Customer (₹)
                          </span>
                          <input
                            type="number" step="1" min="0"
                            value={settle.cash_given}
                            onChange={e => setSettle(s => ({ ...s, cash_given:e.target.value }))}
                            placeholder={`e.g. ${cashRounded.toLocaleString('en-IN')}`}
                            style={{ flex:1, ...monoStyle, fontSize:15, textAlign:'right', padding:'5px 9px' }}
                            className="highlight"
                          />
                        </div>
                        {cashGiven > 0 && (
                          <div style={{
                            display:'flex', justifyContent:'space-between', alignItems:'center',
                            padding:'6px 10px', borderRadius:5, marginTop:4,
                            background: Math.abs(cashBalance) < 1 ? 'rgba(26,110,64,0.06)' : cashBalance > 0 ? 'rgba(26,80,128,0.06)' : 'rgba(184,50,50,0.06)',
                            border: `1px solid ${Math.abs(cashBalance) < 1 ? 'rgba(26,110,64,0.25)' : cashBalance > 0 ? 'rgba(26,80,128,0.2)' : 'rgba(184,50,50,0.25)'}`,
                          }}>
                            <span style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)' }}>
                              {Math.abs(cashBalance) < 1 ? '✓ Cash settled' : cashBalance > 0 ? 'Cash balance pending' : 'Extra cash given'}
                            </span>
                            <span style={{ ...monoStyle, fontSize:14, fontWeight:700,
                              color: Math.abs(cashBalance) < 1 ? 'var(--green)' : cashBalance > 0 ? 'var(--blue)' : 'var(--red)',
                            }}>
                              {Math.abs(cashBalance) < 1 ? '₹0' : `₹${Math.abs(cashBalance).toLocaleString('en-IN')}`}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Remarks</label>
            <textarea rows={2} value={form.remarks} onChange={e => upForm('remarks', e.target.value)} />
          </div>
        </div>

        {/* Summary */}
        <div className="card">
          <div className="card-title">Summary</div>
          <div className="calc-box">
            <div className="calc-row">
              <span className="calc-label">Total Katcha Weight</span>
              <span className="calc-value">{totalKatcha.toFixed(3)} g</span>
            </div>
            <div className="calc-row">
              <span className="calc-label">Total Pure (raw)</span>
              <span className="calc-value">{totalPureRaw.toFixed(3)} g</span>
            </div>
            <div className="calc-row">
              <span className="calc-label">× {pureTouchVal}% Pure Touch</span>
              <span className="calc-value" style={{ color:'var(--green)' }}>{actualPureGold.toFixed(3)} g</span>
            </div>
            {obGold > 0 && (
              <div className="calc-row">
                <span className="calc-label" style={{ color: settle.use_ob ? 'var(--red)' : 'var(--text-muted)', fontWeight:600 }}>
                  {settle.use_ob ? '− Sales OB Deduction' : '⏭ Sales OB Skipped'}
                </span>
                <span className="calc-value" style={{ color: settle.use_ob ? 'var(--red)' : 'var(--text-muted)' }}>
                  {settle.use_ob ? `−${obGold.toFixed(3)} g` : `(${obGold.toFixed(3)}g → next)`}
                </span>
              </div>
            )}
            <div className="calc-row total">
              <span className="calc-label">NET PURE OWED</span>
              <span className="calc-value big">{netPureOwed.toFixed(3)} g</span>
            </div>
          </div>

          {settle.cash_gold !== '' && (
            <div className="calc-box" style={{ marginTop:10 }}>
              <div className="calc-row">
                <span className="calc-label">Gold Given</span>
                <span className="calc-value">{cashGold.toFixed(3)} g</span>
              </div>
              {isSales && (
                <div className="calc-row">
                  <span className="calc-label">Extra (→ Sales OB)</span>
                  <span className="calc-value" style={{ color:'var(--blue)' }}>+{diff.toFixed(3)} g</span>
                </div>
              )}
              {isPurchase && (
                <>
                  <div className="calc-row">
                    <span className="calc-label">Pending Gold</span>
                    <span className="calc-value" style={{ color:'var(--red)' }}>{Math.abs(diff).toFixed(3)} g</span>
                  </div>
                  <div className="calc-row">
                    <span className="calc-label">Cash equivalent</span>
                    <span className="calc-value">₹{cashForPurchase.toFixed(2)}</span>
                  </div>
                  <div className="calc-row total">
                    <span className="calc-label">CASH TO PAY (rounded)</span>
                    <span className="calc-value big" style={{ color:'var(--gold-dark)' }}>
                      ₹{cashRounded.toLocaleString('en-IN')}
                    </span>
                  </div>
                  {cashGiven > 0 && (
                    <>
                      <div className="calc-row">
                        <span className="calc-label">Cash Given</span>
                        <span className="calc-value" style={{ color:'var(--green)' }}>
                          ₹{cashGiven.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="calc-row total">
                        <span className="calc-label">
                          {Math.abs(cashBalance) < 1 ? 'CASH SETTLED ✓' : cashBalance > 0 ? 'CASH PENDING' : 'EXTRA CASH'}
                        </span>
                        <span className="calc-value big" style={{
                          color: Math.abs(cashBalance) < 1 ? 'var(--green)' : cashBalance > 0 ? 'var(--blue)' : 'var(--red)'
                        }}>
                          {Math.abs(cashBalance) < 1 ? '₹0' : `₹${Math.abs(cashBalance).toLocaleString('en-IN')}`}
                        </span>
                      </div>
                    </>
                  )}
                </>
              )}
              {isNil && (
                <div className="calc-row total">
                  <span className="calc-label">BALANCE</span>
                  <span className="calc-value big" style={{ color:'var(--green)' }}>0.000 g ✓</span>
                </div>
              )}
            </div>
          )}

          {obCash !== 0 && (
            <div style={{
              marginTop:10, padding:'8px 14px', borderRadius:6, fontSize:13,
              background:'rgba(26,80,128,0.05)', border:'1px solid rgba(26,80,128,0.18)',
            }}>
              <span style={{ color:'var(--text-muted)' }}>Exchange OB Cash: </span>
              <strong style={{ ...monoStyle, color:'var(--blue)' }}>
                ₹{Math.abs(obCash).toLocaleString('en-IN', { minimumFractionDigits:2 })}
              </strong>
            </div>
          )}
        </div>
      </div>

      {/* Bottom action bar */}
      <div style={{ marginTop:4 }}>
        {/* Success banner with Print button — shown after save */}
        {msg?.type === 'success' && (
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            gap:12, padding:'12px 18px', marginBottom:8, borderRadius:7,
            background:'rgba(26,110,64,0.09)', border:'1.5px solid rgba(26,110,64,0.35)',
          }}>
            <span style={{ fontWeight:600, color:'var(--green)', fontSize:13 }}>
              ✓ {msg.text}
            </span>
            {lastSaved && (
              <button onClick={() => setLastSaved(s => ({ ...s, _showPrint: true }))}
                style={{
                  background:'#6B4A00', color:'#FFF5D6', border:'none',
                  padding:'8px 20px', borderRadius:6, fontWeight:700,
                  fontSize:13, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
                  display:'flex', alignItems:'center', gap:6,
                }}>
                🖨 Print Receipt
              </button>
            )}
          </div>
        )}
        <div className="btn-group" style={{ justifyContent:'flex-end' }}>
          <button className="btn btn-secondary" onClick={handleClear}>Clear</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : '✦ Save Exchange Voucher'}
          </button>
        </div>
      </div>

      {/* Print receipt — opens when Print button clicked */}
      {lastSaved?._showPrint && (
        <PrintReceipt
          voucher={lastSaved}
          type="exchange"
          onClose={() => setLastSaved(s => ({ ...s, _showPrint: false }))}
        />
      )}

    </div>
  );
}
