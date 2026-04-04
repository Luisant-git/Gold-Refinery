// client/src/pages/BankEntry.jsx
import React, { useState, useEffect, useRef } from 'react';
import { bankEntryAPI, customerAPI } from '../db/api';
import { fmtDate } from '../db/utils';

/* -------------------- Mobile Auto Complete -------------------- */
function MobileAC({ value, onChange, onSelect }) {
  const [sugg, setSugg] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleChange = async (e) => {
    const v = e.target.value;
    onChange(v);

    if (v.length >= 2) {
      const res = await customerAPI.search(v).catch(() => []);
      setSugg(res);
      setOpen(res.length > 0);
    } else {
      setSugg([]);
      setOpen(false);
    }
  };

  const pick = (c) => {
    onChange(c.mobile);
    onSelect(c);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <input
        type="tel"
        value={value}
        onChange={handleChange}
        maxLength={15}
        style={{ width: '100%' }}
        autoComplete="off"
      />

      {open && (
        <div
          style={{
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
          }}
        >
          {sugg.map((c) => (
            <div
              key={c.id}
              onClick={() => pick(c)}
              style={{
                padding: '9px 13px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
                fontSize: 14
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#FBF7EE')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
            >
              <strong style={{ color: 'var(--gold-dark)' }}>{c.mobile}</strong> — {c.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------- Main Component -------------------- */
export default function BankEntry() {
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    entry_date: today,
    mobile: '',
    customer_name: '',
    customer_id: null,
    amount: '',
    entry_type: 'IN',
    payment_mode: 'PHONEPE',
    transaction_id: ''
  });

  const [list, setList] = useState([]);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = () => {
    bankEntryAPI.getAll().then(setList).catch(() => {});
  };

  const upForm = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const onSelect = (c) => {
    setForm((f) => ({
      ...f,
      customer_name: c.name,
      customer_id: c.id
    }));
  };

  /* -------------------- Totals -------------------- */
  const totalIn = list
    .filter((r) => r.entry_type === 'IN')
    .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  const totalOut = list
    .filter((r) => r.entry_type === 'OUT')
    .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  /* -------------------- Save -------------------- */
  const handleSave = async () => {
    if (!form.mobile || !form.customer_name) {
      setMsg({ type: 'danger', text: 'Mobile & Name required' });
      return;
    }

    if (!form.amount || parseFloat(form.amount) <= 0) {
      setMsg({ type: 'danger', text: 'Valid amount required' });
      return;
    }

    if (!form.transaction_id) {
      setMsg({ type: 'danger', text: 'Transaction ID required' });
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

      const res = await bankEntryAPI.create({
        ...form,
        customer_id: custId
      });

      setMsg({
        type: 'success',
        text: `Bank Entry ${res.entry_no} saved!`
      });

      setForm({
        entry_date: today,
        mobile: '',
        customer_name: '',
        customer_id: null,
        amount: '',
        entry_type: 'IN',
        payment_mode: 'PHONEPE',
        transaction_id: ''
      });

      load();
    } catch (e) {
      setMsg({ type: 'danger', text: e.message });
    }

    setSaving(false);
  };

  const modeLabel = {
    PHONEPE: 'PhonePe',
    GPAY: 'GPay',
    NETBANKING: 'Net Banking'
  };

  const monoStyle = { fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 };

  /* -------------------- UI -------------------- */
  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">BANK ENTRY</div>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Totals */}
      <div className="two-col" style={{ marginBottom: 0 }}>
        <div className="stat-card" style={{ borderColor: 'rgba(26,110,64,0.3)' }}>
          <div className="stat-icon" style={{ color: 'var(--green)' }}>↓</div>
          <div className="stat-value" style={{ color: 'var(--green)', ...monoStyle }}>
            ₹{totalIn.toLocaleString('en-IN')}
          </div>
          <div className="stat-label">Total Bank IN</div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(184,50,50,0.3)' }}>
          <div className="stat-icon" style={{ color: 'var(--red)' }}>↑</div>
          <div className="stat-value" style={{ color: 'var(--red)', ...monoStyle }}>
            ₹{totalOut.toLocaleString('en-IN')}
          </div>
          <div className="stat-label">Total Bank OUT</div>
        </div>
      </div>

      {/* Form */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-title">New Bank Entry</div>

        <div className="form-grid form-grid-3" style={{ marginBottom: 12 }}>
          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              value={form.entry_date}
              onChange={(e) => upForm('entry_date', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Mobile</label>
            <MobileAC
              value={form.mobile}
              onChange={(v) => upForm('mobile', v)}
              onSelect={onSelect}
            />
          </div>

          <div className="form-group">
            <label>Customer Name</label>
            <input
              value={form.customer_name}
              onChange={(e) => upForm('customer_name', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => upForm('amount', e.target.value)}
              className="highlight"
            />
          </div>

          <div className="form-group">
            <label>Type</label>
            <select
              value={form.entry_type}
              onChange={(e) => upForm('entry_type', e.target.value)}
            >
              <option value="IN">IN — Amount received in bank</option>
              <option value="OUT">OUT — Amount sent from bank</option>
            </select>
          </div>

          <div className="form-group">
            <label>Payment Mode</label>
            <select
              value={form.payment_mode}
              onChange={(e) => upForm('payment_mode', e.target.value)}
            >
              <option value="PHONEPE">PhonePe</option>
              <option value="GPAY">GPay</option>
              <option value="NETBANKING">Net Banking</option>
            </select>
          </div>

          <div className="form-group">
            <label>Transaction ID</label>
            <input
              value={form.transaction_id}
              onChange={(e) => upForm('transaction_id', e.target.value)}
            />
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : '✦ Save Bank Entry'}
        </button>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-title">Recent Bank Entries</div>

        {list.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏦</div>
            <p>No entries yet</p>
          </div>
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
                  <th>Mode</th>
                  <th>Txn ID</th>
                </tr>
              </thead>

              <tbody>
                {list.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 12 }}>{fmtDate(r.entry_date)}</td>
                    <td className="font-mono text-gold" style={{ fontSize: 12 }}>
                      {r.entry_no}
                    </td>
                    <td>{r.customer_name}</td>
                    <td style={{ fontSize: 12 }}>{r.mobile}</td>
                    <td className="right td-number">
                      ₹{parseFloat(r.amount).toLocaleString('en-IN', {
                        minimumFractionDigits: 2
                      })}
                    </td>
                    <td className="center">
                      <span className={`badge ${r.entry_type === 'IN' ? 'badge-success' : 'badge-danger'}`}>
                        {r.entry_type}
                      </span>
                    </td>
                    <td>{modeLabel[r.payment_mode] || r.payment_mode}</td>
                    <td style={{ fontSize: 12 }}>{r.transaction_id}</td>
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