// client/src/pages/CashEntry.jsx
import React, { useState, useEffect, useRef } from 'react';
import { cashEntryAPI, customerAPI } from '../db/api';
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
      <input
        type="tel"
        value={value}
        onChange={hc}
        maxLength={15}
        style={{ width: '100%' }}
        autoComplete="off"
      />
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
              onMouseEnter={e => (e.currentTarget.style.background = '#FBF7EE')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              <strong style={{ color: 'var(--gold-dark)' }}>{c.mobile}</strong> — {c.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CashEntry() {
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    entry_date: today,
    mobile: '',
    customer_name: '',
    customer_id: null,
    amount: '',
    entry_type: 'OUT',
    remarks: '',
    ob_cash: 0,
    ob_gold: 0
  });

  const [list, setList] = useState([]);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);
  const load = () => cashEntryAPI.getAll().then(setList).catch(() => { });
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

  const totalIn = list.filter(r => r.entry_type === 'IN').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const totalOut = list.filter(r => r.entry_type === 'OUT').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  const handleSave = async () => {
    if (!form.mobile || !form.customer_name) {
      setMsg({ type: 'danger', text: 'Mobile and name required' });
      return;
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setMsg({ type: 'danger', text: 'Amount required' });
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

      const r = await cashEntryAPI.create({
        ...form,
        customer_id: custId
      });



      const customer = await customerAPI.getByMobile(form.mobile);
      console.log('Customer before update:', customer);

      const currentCash = parseFloat(customer?.ob_cash || 0);
      const currentGold = parseFloat(customer?.ob_gold || 0);
      const amt = parseFloat(form.amount || 0);

      const nextCash = form.entry_type === 'OUT'
        ? currentCash + amt
        : currentCash - amt;

      console.log('Updating customer balance:', {
        custId,
        mobile: form.mobile,
        currentCash,
        currentGold,
        amt,
        nextCash
      });

      const updRes = await customerAPI.update(custId, {
        mobile: customer?.mobile || form.mobile,
        name: customer?.name || form.customer_name,
        address: customer?.address || '',
        ob_gold: currentGold,
        ob_cash: nextCash
      });

      console.log('Update response:', updRes);

      if (!updRes?.success) {
        throw new Error(updRes?.error || 'Customer balance update failed');
      }

      const verify = await customerAPI.getByMobile(form.mobile);
      console.log('Customer after update:', verify);

      setMsg({ type: 'success', text: `Cash Entry ${r.entry_no} saved!` });

      setForm({
        entry_date: today,
        mobile: '',
        customer_name: '',
        customer_id: null,
        amount: '',
        entry_type: 'OUT',
        remarks: '',
        ob_cash: 0,
        ob_gold: 0
      });

      load();
    } catch (e) {
      setMsg({ type: 'danger', text: e.message });
    }

    setSaving(false);
  };

  const monoStyle = { fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">CASH ENTRY</div>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="two-col" style={{ marginBottom: 0 }}>
        <div className="stat-card" style={{ borderColor: 'rgba(26,110,64,0.3)' }}>
          <div className="stat-icon" style={{ color: 'var(--green)' }}>↓</div>
          <div className="stat-value" style={{ color: 'var(--green)', ...monoStyle }}>
            ₹{totalIn.toLocaleString('en-IN')}
          </div>
          <div className="stat-label">Total Cash IN</div>
        </div>
        <div className="stat-card" style={{ borderColor: 'rgba(184,50,50,0.3)' }}>
          <div className="stat-icon" style={{ color: 'var(--red)' }}>↑</div>
          <div className="stat-value" style={{ color: 'var(--red)', ...monoStyle }}>
            ₹{totalOut.toLocaleString('en-IN')}
          </div>
          <div className="stat-label">Total Cash OUT</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-title">New Cash Entry</div>

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
          <div className="form-group">
            <label>Date</label>
            <input type="date" value={form.entry_date} onChange={e => upForm('entry_date', e.target.value)} />
          </div>

          <div className="form-group">
            <label>Mobile</label>
            <MobileAC value={form.mobile} onChange={v => upForm('mobile', v)} onSelect={onSelect} />
          </div>

          <div className="form-group">
            <label>Customer Name</label>
            <input type="text" value={form.customer_name} onChange={e => upForm('customer_name', e.target.value)} />
          </div>

          <div className="form-group">
            <label>Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={e => upForm('amount', e.target.value)}
              className="highlight"
            />
          </div>

          <div className="form-group">
            <label>Type</label>
            <select value={form.entry_type} onChange={e => upForm('entry_type', e.target.value)}>
              <option value="OUT">OUT — Cash given to customer</option>
              <option value="IN">IN — Cash received from customer</option>
            </select>
          </div>

          <div className="form-group">
            <label>Remarks</label>
            <input type="text" value={form.remarks} onChange={e => upForm('remarks', e.target.value)} />
          </div>
        </div>

        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : '✦ Save Cash Entry'}
        </button>
      </div>

      <div className="card">
        <div className="card-title">Recent Cash Entries</div>
        {list.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">₹</div><p>No entries yet</p></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Entry No</th>
                  <th>Customer</th>
                  <th>Mobile</th>
                  <th className="right">Amount (₹)</th>
                  <th className="center">Type</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 12 }}>{fmtDate(r.entry_date)}</td>
                    <td className="font-mono text-gold" style={{ fontSize: 12 }}>{r.entry_no}</td>
                    <td>{r.customer_name}</td>
                    <td style={{ fontSize: 12 }}>{r.mobile}</td>
                    <td className="right td-number">
                      ₹{parseFloat(r.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="center">
                      <span className={`badge ${r.entry_type === 'IN' ? 'badge-success' : 'badge-danger'}`}>
                        {r.entry_type}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}