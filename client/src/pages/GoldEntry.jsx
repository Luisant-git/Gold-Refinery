// client/src/pages/GoldEntry.jsx
import React, { useState, useEffect, useRef } from 'react';
import { goldEntryAPI, customerAPI } from '../db/api';
import { fmtDate } from '../db/utils';

function MobileAC({ value, onChange, onSelect }) {
  const [sugg, setSugg] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const hc = async e => {
    const v = e.target.value;
    onChange(v);
    if (v.length >= 2) {
      const r = await customerAPI.search(v).catch(() => []);
      setSugg(r);
      setOpen(r.length > 0);
    } else {
      setSugg([]);
      setOpen(false);
    }
  };

  const pick = row => {
    onChange(row.mobile);
    onSelect(row);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <input type="tel" value={value} onChange={hc} maxLength={15} style={{ width: '100%' }} autoComplete="off" />
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 999,
          background: '#fff',
          border: '1.5px solid var(--gold-accent)',
          borderRadius: 6,
          boxShadow: '0 4px 18px rgba(100,70,0,0.15)',
          maxHeight: 200,
          overflowY: 'auto'
        }}>
          {sugg.map(c => (
            <div
              key={c.id}
              onClick={() => pick(c)}
              style={{
                padding: '9px 13px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
                fontSize: 14
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#FBF7EE'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              <strong style={{ color: 'var(--gold-dark)' }}>{c.mobile}</strong> — {c.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GoldEntry() {
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    entry_date: today,
    mobile: '',
    customer_name: '',
    customer_id: null,
    gold_wt: '',
    touch: '99.90',
    entry_type: 'OUT',
    remarks: '',
    ob_cash: 0,
    ob_gold: 0
  });

  const [list, setList] = useState([]);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);
const load = async () => {
  try {
    const rows = await goldEntryAPI.getAll();
    console.log('Gold entry rows:', rows);
    setList(rows);
  } catch (err) {
    console.error('Gold entries load failed:', err);
  }
};
  const upForm = (k, v) => setForm(f => ({ ...f, [k]: v }));

const onSelect = async c => {
  try {
    const full = await customerAPI.getByMobile(c.mobile);
    setForm(f => ({
      ...f,
      mobile: c.mobile,
      customer_name: c.name,
      customer_id: c.id,
      ob_cash: parseFloat(full?.ob_cash || 0),
      ob_gold: parseFloat(full?.ob_gold || 0)
    }));
  } catch {
    setForm(f => ({
      ...f,
      mobile: c.mobile,
      customer_name: c.name,
      customer_id: c.id,
      ob_cash: 0,
      ob_gold: 0
    }));
  }
};
  const goldWt = parseFloat(form.gold_wt) || 0;
  const touch = parseFloat(form.touch) || 99.90;
  const pureWt = parseFloat((goldWt * touch / 100).toFixed(3));

 const totalIn = list
  .filter(r => String(r.entry_type).toUpperCase() === 'IN')
  .reduce((s, r) => s + (parseFloat(r.pure_wt) || 0), 0);

const totalOut = list
  .filter(r => String(r.entry_type).toUpperCase() === 'OUT')
  .reduce((s, r) => s + (parseFloat(r.pure_wt) || 0), 0);
  const monoStyle = { fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 };

  const handleSave = async () => {
    if (!form.mobile || !form.customer_name) {
      setMsg({ type: 'danger', text: 'Mobile and name required' });
      return;
    }

    if (!form.gold_wt || goldWt <= 0) {
      setMsg({ type: 'danger', text: 'Gold weight required' });
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      let custId = form.customer_id;

      if (!custId) {
        const res = await customerAPI.create({
          mobile: form.mobile,
          name: form.customer_name,
          ob_gold: 0,
          ob_cash: 0
        });
        custId = res.id;
      }

      const payload = {
        entry_date: form.entry_date,
        mobile: form.mobile,
        customer_name: form.customer_name,
        customer_id: custId,
       entry_type: form.entry_type.toLowerCase(),
        remarks: form.remarks,
        weight: goldWt,
        touch: touch,
        pure_wt: pureWt
      };

      const r = await goldEntryAPI.create(payload);
console.log('Gold create response:', r);

if (!r?.success) {
  throw new Error(r?.error || 'Gold entry save failed');
}

    const customer = await customerAPI.getByMobile(form.mobile);
console.log('Customer before gold update:', {
  id: customer?.id,
  mobile: customer?.mobile,
  name: customer?.name,
  ob_cash: customer?.ob_cash,
  ob_gold: customer?.ob_gold
});

const currentCash = parseFloat(customer?.ob_cash || 0);
const currentGold = parseFloat(customer?.ob_gold || 0);

const nextGold = form.entry_type === 'OUT'
  ? currentGold + pureWt
  : currentGold - pureWt;

console.log('Updating customer gold balance:', {
  custId,
  currentCash,
  currentGold,
  pureWt,
  nextGold
});

const updRes = await customerAPI.update(custId, {
  mobile: customer?.mobile || form.mobile,
  name: customer?.name || form.customer_name,
  address: customer?.address || '',
  ob_gold: nextGold,
  ob_cash: currentCash
});

console.log('Gold update response:', updRes);

if (!updRes?.success) {
  throw new Error(updRes?.error || 'Customer gold balance update failed');
}

const verify = await customerAPI.getByMobile(form.mobile);
console.log('Customer after gold update:', {
  id: verify?.id,
  mobile: verify?.mobile,
  name: verify?.name,
  ob_cash: verify?.ob_cash,
  ob_gold: verify?.ob_gold
});
      setMsg({
        type: 'success',
        text: `Gold Entry ${r.entry_no} saved! Pure: ${pureWt.toFixed(3)}g`
      });

    setForm({
  entry_date: today,
  mobile: form.mobile,
  customer_name: form.customer_name,
  customer_id: custId,
  gold_wt: '',
  touch: '99.90',
  entry_type: 'OUT',
  remarks: '',
  ob_cash: currentCash,
  ob_gold: nextGold
});
      await load();
    } catch (e) {
      setMsg({ type: 'danger', text: e.message });
    }

    setSaving(false);
  };

  return (
    <div className="page">
      <div className="page-header"><div className="page-title">GOLD ENTRY</div></div>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="two-col" style={{ marginBottom: 0 }}>
        <div className="stat-card" style={{ borderColor: 'rgba(26,110,64,0.3)' }}>
          <div className="stat-icon" style={{ color: 'var(--green)' }}>↓</div>
          <div className="stat-value" style={{ color: 'var(--green)', ...monoStyle }}>{totalIn.toFixed(3)}g</div>
          <div className="stat-label">Total Gold IN</div>
        </div>
        <div className="stat-card" style={{ borderColor: 'rgba(184,50,50,0.3)' }}>
          <div className="stat-icon" style={{ color: 'var(--red)' }}>↑</div>
          <div className="stat-value" style={{ color: 'var(--red)', ...monoStyle }}>{totalOut.toFixed(3)}g</div>
          <div className="stat-label">Total Gold OUT</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-title">New Gold Entry</div>

        {form.customer_id && (
          <div style={{
            marginBottom: 12,
            padding: '10px 14px',
            background: '#FAF7EF',
            border: '1px solid var(--border)',
            borderRadius: 6,
            display: 'flex',
            gap: 18,
            flexWrap: 'wrap'
          }}>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>OB Cash: </span>
              <strong style={{ color: 'var(--blue)', fontFamily: 'JetBrains Mono, monospace' }}>
                ₹{parseFloat(form.ob_cash || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>OB Gold: </span>
              <strong style={{ color: 'var(--gold-dark)', fontFamily: 'JetBrains Mono, monospace' }}>
                {parseFloat(form.ob_gold || 0).toFixed(3)} g
              </strong>
            </div>
          </div>
        )}

        <div className="form-grid form-grid-3" style={{ marginBottom: 12 }}>
          <div className="form-group"><label>Date</label>
            <input type="date" value={form.entry_date} onChange={e => upForm('entry_date', e.target.value)} /></div>
          <div className="form-group"><label>Mobile</label>
            <MobileAC value={form.mobile} onChange={v => upForm('mobile', v)} onSelect={onSelect} /></div>
          <div className="form-group"><label>Customer Name</label>
            <input type="text" value={form.customer_name} onChange={e => upForm('customer_name', e.target.value)} /></div>
          <div className="form-group"><label>Gold Weight (g)</label>
            <input type="number" step="0.001" min="0" value={form.gold_wt} onChange={e => upForm('gold_wt', e.target.value)} className="highlight" /></div>
          <div className="form-group"><label>Touch (%)</label>
            <input type="number" step="0.01" min="0" value={form.touch} onChange={e => upForm('touch', e.target.value)} className="highlight" /></div>
          <div className="form-group"><label>Type</label>
            <select value={form.entry_type} onChange={e => upForm('entry_type', e.target.value)}>
              <option value="OUT">OUT — Gold given to customer</option>
              <option value="IN">IN — Gold received from customer</option>
            </select></div>
          <div className="form-group"><label>Remarks</label>
            <input type="text" value={form.remarks} onChange={e => upForm('remarks', e.target.value)} /></div>
        </div>

        {goldWt > 0 && (
          <div style={{
            marginBottom: 12,
            padding: '7px 12px',
            background: '#F0FAF4',
            border: '1px solid rgba(26,110,64,0.25)',
            borderRadius: 6,
            fontSize: 13
          }}>
            Pure Wt: <strong style={{ ...monoStyle, color: 'var(--green)' }}>
              {goldWt.toFixed(3)}g × {touch}% ÷ 100 = {pureWt.toFixed(3)}g
            </strong>
          </div>
        )}

        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : '✦ Save Gold Entry'}
        </button>
      </div>

      <div className="card">
        <div className="card-title">Recent Gold Entries</div>
        {list.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">⬡</div><p>No entries yet</p></div>
        ) : (
          <div className="table-container"><table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Entry No</th>
                <th>Customer</th>
                <th>Mobile</th>
                <th className="right">Gold Wt (g)</th>
                <th className="right">Touch (%)</th>
                <th className="right">Pure Wt (g)</th>
                <th className="center">Type</th>
              </tr>
            </thead>
            <tbody>{list.map((r, i) => (
              <tr key={i}>
                <td style={{ fontSize: 12 }}>{fmtDate(r.entry_date)}</td>
                <td className="font-mono text-gold" style={{ fontSize: 12 }}>{r.entry_no}</td>
                <td>{r.customer_name}</td>
                <td style={{ fontSize: 12 }}>{r.mobile}</td>
                <td className="right td-number">{parseFloat(r.weight).toFixed(3)}</td>
                <td className="right td-number">{parseFloat(r.touch).toFixed(2)}</td>
                <td className="right td-number" style={{ color: 'var(--green)' }}>{parseFloat(r.pure_wt).toFixed(3)}</td>
                <td className="center">
                 <span className={`badge ${String(r.entry_type).toUpperCase() === 'IN' ? 'badge-success' : 'badge-danger'}`}>
  {String(r.entry_type).toUpperCase()}
</span>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}