// client/src/pages/ExchangeVoucher.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exchangeAPI, customerAPI, rateAPI, pureTokenAPI } from '../db/api';
import PrintReceipt from '../components/PrintReceipt';

const EMPTY_ROW = {
  token_no: '',
  katcha_wt: '',
  katcha_touch: '',
  less_touch: '',
  balance_touch: '',
  pure_wt: ''
};

function MobileAutocomplete({ value, onChange, onSelect }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const ref = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const h = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
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
    } else {
      setSuggestions([]);
      setOpen(false);
    }
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
        pick(suggestions[0]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIdx(-1);
    }
  };

  useEffect(() => {
    if (activeIdx >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-item]');
      if (items[activeIdx]) items[activeIdx].scrollIntoView({ block: 'nearest' });
    }
  }, [activeIdx]);

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <input
        type="tel"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        maxLength={15}
        style={{ width: '100%' }}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div
          ref={listRef}
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
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {suggestions.map((c, idx) => (
            <div
              key={c.id}
              data-item
              onClick={() => pick(c)}
              onMouseEnter={() => setActiveIdx(idx)}
              onMouseLeave={() => setActiveIdx(-1)}
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
                fontSize: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: idx === activeIdx ? '#FBF7EE' : '#fff',
                borderLeft: idx === activeIdx ? '3px solid var(--gold-accent)' : '3px solid transparent',
              }}
            >
              <span>
                <strong style={{ color: 'var(--gold-dark)' }}>{c.mobile}</strong>
                <span style={{ color: 'var(--text-sub)', marginLeft: 8 }}>{c.name}</span>
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                {parseFloat(c.ob_exchange_gold || 0) !== 0 && (
                  <span style={{ color: 'var(--green)', fontFamily: 'JetBrains Mono,monospace', fontWeight: 600 }}>
                    EX-G: {parseFloat(c.ob_exchange_gold).toFixed(3)}g
                  </span>
                )}
                {parseFloat(c.ob_exchange_cash || 0) !== 0 && (
                  <span style={{ color: 'var(--blue)', fontFamily: 'JetBrains Mono,monospace', fontWeight: 600 }}>
                    EX-₹: {parseFloat(c.ob_exchange_cash).toFixed(2)}
                  </span>
                )}
              </span>
            </div>
          ))}
          <div
            style={{
              padding: '5px 10px',
              fontSize: 11,
              color: 'var(--text-muted)',
              borderTop: '1px solid var(--border)',
              background: '#FAFAF5'
            }}
          >
            ↑↓ navigate · Enter to select · Esc to close
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExchangeVoucher() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const today = new Date().toISOString().split('T')[0];

  const [voucherNo, setVoucherNo] = useState('Loading...');
  const [lastSaved, setLastSaved] = useState(null);

  const [form, setForm] = useState({
    voucher_date: today,
    mobile: '',
    customer_name: '',
    customer_id: null,
    rate_per_gram: '',
    pure_touch: '',
    remarks: '',
    ob_exchange_gold: 0,
    ob_exchange_cash: 0,
    ob_gold: 0,
    ob_cash: 0,
    ob_items: [],
    ob_last_voucher: null,
    ob_last_date: null,
    ob_tx_type: null,
  });

  const [items, setItems] = useState([{ ...EMPTY_ROW }]);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [latestRate, setLatestRate] = useState(null);
  const [defaultPureTouch, setDefaultPureTouch] = useState('');

  const [settle, setSettle] = useState({
    mode: 'purchase',
    cash_gold: '',
    use_ob: true,
    use_ob_cash: true,
    cash_given: ''
  });

  const monoStyle = { fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 };

  useEffect(() => {
    if (!editId) return;

    const loadVoucherForEdit = async () => {
      try {
        const data = await exchangeAPI.getById(editId);
        if (!data) return;

        setVoucherNo(data.voucher_no || '—');

        setForm({
          voucher_date: data.voucher_date || today,
          mobile: data.mobile || '',
          customer_name: data.customer_name || '',
          customer_id: data.customer_id || null,
          rate_per_gram: data.rate_per_gram || '',
          pure_touch: data.pure_touch || defaultPureTouch || '',
          remarks: data.remarks || '',
          ob_exchange_gold: data.ob_exchange_gold || 0,
          ob_exchange_cash: data.ob_exchange_cash || 0,
          ob_gold: data.ob_gold || 0,
          ob_cash: data.ob_cash || 0,
          ob_items: data.ob_items || [],
          ob_last_voucher: data.ob_last_voucher || null,
          ob_last_date: data.ob_last_date || null,
          ob_tx_type: data.ob_tx_type || null,
        });

        setItems(
          data.items && data.items.length > 0
            ? data.items.map(item => ({
                token_no: item.token_no || '',
                katcha_wt: item.katcha_wt || '',
                katcha_touch: item.katcha_touch || '',
                less_touch: item.less_touch || '',
                balance_touch: item.balance_touch || '',
                pure_wt: item.pure_wt || '',
              }))
            : [{ ...EMPTY_ROW }]
        );

        setSettle({
          mode: data.transaction_type || 'purchase',
          cash_gold: data.pure_gold_given || '',
          use_ob: data.ob_skipped ? false : true,
          use_ob_cash: data.use_ob_cash !== undefined ? !!data.use_ob_cash : true,
          cash_given: data.cash_for_remaining || ''
        });
      } catch (e) {
        console.error('Edit load failed:', e);
        setMsg({ type: 'danger', text: 'Failed to load voucher for edit' });
      }
    };

    loadVoucherForEdit();
  }, [editId, defaultPureTouch, today]);

  useEffect(() => {
    rateAPI.getLatest()
      .then(r => {
        if (r) {
          setLatestRate(r);
          setForm(f => ({ ...f, rate_per_gram: r.rate_24k }));
        }
      })
      .catch(() => {});

    pureTokenAPI.getAll()
      .then(rows => {
        if (rows && rows.length > 0) {
          const tokenValue = rows[0]?.value || rows[0]?.pure_touch || rows[0]?.token || '';
          setDefaultPureTouch(tokenValue);
          setForm(f => ({ ...f, pure_touch: f.pure_touch || tokenValue }));
        }
      })
      .catch(() => {});

    exchangeAPI.getNextNo()
      .then(no => setVoucherNo(no))
      .catch(() => setVoucherNo('—'));
  }, []);

  const upForm = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const onMobileSelect = async cust => {
    setForm(f => ({
      ...f,
      mobile: cust.mobile || '',
      customer_name: cust.name || '',
      customer_id: cust.id || null,
      ob_exchange_gold: 0,
      ob_exchange_cash: 0,
      ob_gold: Number(cust?.ob_gold ?? 0),
      ob_cash: Number(cust?.ob_cash ?? 0),
      ob_items: [],
    }));

    setSettle(s => ({
      ...s,
      use_ob: true,
      use_ob_cash: true
    }));

    try {
      const ob = await exchangeAPI.getCustomerOB(cust.id);

      setForm(f => ({
        ...f,
        mobile: cust.mobile || '',
        customer_name: cust.name || '',
        customer_id: cust.id || null,
        ob_exchange_gold: Number(ob?.ob_gold ?? ob?.ob_exchange_gold ?? 0),
        ob_exchange_cash: Number(ob?.ob_cash ?? ob?.ob_exchange_cash ?? 0),
        ob_gold: Number(cust?.ob_gold ?? 0),
        ob_cash: Number(cust?.ob_cash ?? 0),
        ob_items: Array.isArray(ob?.ob_items) ? ob.ob_items : [],
      }));
    } catch (err) {
      console.error('Exchange OB fetch failed:', err);
      setForm(f => ({
        ...f,
        ob_exchange_gold: 0,
        ob_exchange_cash: 0,
        ob_gold: Number(cust?.ob_gold ?? 0),
        ob_cash: Number(cust?.ob_cash ?? 0),
        ob_items: [],
      }));
    }
  };

  const floorTo3Decimal = (num) => {
    const n = parseFloat(num) || 0;
    return Math.floor(n * 1000) / 1000;
  };

  const floorTo1DecimalDisplay2 = (num) => {
    const n = parseFloat(num) || 0;
    return (Math.floor(n * 10) / 10).toFixed(2);
  };

  const upItem = (idx, field, value) => {
    setItems(prev =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const u = { ...row, [field]: value };
        const kt = parseFloat(field === 'katcha_touch' ? value : u.katcha_touch) || 0;
        const lt = parseFloat(field === 'less_touch' ? value : u.less_touch) || 0;
        u.balance_touch = kt > 0 ? parseFloat((kt - lt).toFixed(2)) : '';
        const kw = parseFloat(field === 'katcha_wt' ? value : u.katcha_wt) || 0;
        const bt = parseFloat(u.balance_touch) || 0;
        u.pure_wt = kw > 0 && bt > 0 ? floorTo1DecimalDisplay2((kw * bt) / 100) : '';
        return u;
      })
    );
  };

  const totalKatcha = items.reduce((s, r) => s + (parseFloat(r.katcha_wt) || 0), 0);
  const totalPureRaw = items.reduce((s, r) => s + (parseFloat(r.pure_wt) || 0), 0);

  const pureTouchVal = parseFloat(form.pure_touch) || 99.92;

  const obGold = parseFloat(form.ob_exchange_gold) || 0;
  const obCash = parseFloat(form.ob_exchange_cash) || 0;

  const generalObGold = parseFloat(form.ob_gold) || 0;
  const generalObCash = parseFloat(form.ob_cash) || 0;

  const totalObGold = obGold + generalObGold;
  const totalObCash = obCash + generalObCash;

  const appliedObGold = settle.use_ob ? totalObGold : 0;
  const appliedObCash = settle.use_ob_cash ? totalObCash : 0;

  const rate = parseFloat(form.rate_per_gram) || 0;
  const cashGold = parseFloat(settle.cash_gold) || 0;
  const cashGiven = parseFloat(settle.cash_given) || 0;

  const actualPureGold = cashGold > 0
    ? floorTo3Decimal((cashGold * pureTouchVal) / 100)
    : 0;

  const netPureOwed = floorTo3Decimal(totalPureRaw - appliedObGold);

  const diff = parseFloat((actualPureGold - netPureOwed).toFixed(3));
  const pendingGold = Math.max(0, parseFloat((netPureOwed - actualPureGold).toFixed(3)));
  const extraGold = Math.max(0, parseFloat((actualPureGold - netPureOwed).toFixed(3)));

  const isExact = settle.cash_gold !== '' && Math.abs(diff) < 0.001;
  const isSalesRaw = settle.cash_gold !== '' && diff > 0.001;
  const isPurchaseRaw = settle.cash_gold !== '' && diff < -0.001;

  const cashForPurchase =
    isPurchaseRaw && pendingGold > 0 && rate > 0
      ? parseFloat((pendingGold * rate).toFixed(2))
      : 0;

  const totalCashDue = cashForPurchase + appliedObCash;
  const cashRounded = Math.round(totalCashDue);
  const extraCash = Math.max(0, parseFloat((cashGiven - cashRounded).toFixed(2)));
  const pendingCash = Math.max(0, parseFloat((cashRounded - cashGiven).toFixed(2)));

  const purchaseCashSettled =
    isPurchaseRaw &&
    pendingGold > 0 &&
    cashGiven > 0 &&
    cashGiven >= totalCashDue * 0.99;

  const isNil = settle.cash_gold !== '' && (isExact || purchaseCashSettled);
  const isSales = settle.cash_gold !== '' && isSalesRaw;
  const isPurchase = settle.cash_gold !== '' && isPurchaseRaw && !purchaseCashSettled;
  const showPurchaseCashInput = settle.cash_gold !== '' && isPurchaseRaw;

  const handleSave = async () => {
    if (!form.mobile) {
      setMsg({ type: 'danger', text: 'Mobile required' });
      return;
    }
    if (!form.customer_name) {
      setMsg({ type: 'danger', text: 'Customer name required' });
      return;
    }

    const valid = items.filter(r => r.katcha_wt && r.balance_touch);
    if (!valid.length) {
      setMsg({ type: 'danger', text: 'Add at least one row with Katcha Weight and Touch' });
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
          ob_exchange_gold: 0,
          ob_exchange_cash: 0,
          ob_gold: 0,
          ob_cash: 0,
        });
        custId = res.id;
      }

      const actualDiff = parseFloat((actualPureGold - netPureOwed).toFixed(3));

      let finalTxType = 'nil';
      if (actualDiff > 0.001) {
        finalTxType = 'sales';
      } else if (actualDiff < -0.001) {
        finalTxType = purchaseCashSettled ? 'nil' : 'purchase';
      }

      const vData = {
        ...form,
        customer_id: custId,
        pure_gold_given: cashGold,
        cash_for_remaining: cashGiven > 0 ? cashGiven : 0,
        total_pure_wt: netPureOwed,
        actual_pure_gold: actualPureGold,
        transaction_type: finalTxType,
        diff_gold: actualDiff,
        ob_applied: appliedObGold,
        ob_cash_applied: appliedObCash,
        ob_skipped: settle.use_ob ? 0 : totalObGold,
        ob_cash_skipped: settle.use_ob_cash ? 0 : totalObCash,
        use_ob: settle.use_ob ? 1 : 0,
        use_ob_cash: settle.use_ob_cash ? 1 : 0,
      };

      const result = editId
        ? await exchangeAPI.update(editId, vData, valid)
        : await exchangeAPI.create(vData, valid);

      const full = await exchangeAPI.getById(result.id).catch(() => null);
      setLastSaved(full);
      setVoucherNo(result.voucher_no);
      setMsg({
        type: 'success',
        text: editId
          ? `Exchange Voucher #${result.voucher_no} updated!`
          : `Exchange Voucher #${result.voucher_no} saved!`
      });

      setTimeout(() => {
        handleClear();
        setMsg(null);
      }, 8000);
    } catch (e) {
      setMsg({ type: 'danger', text: e.message });
    }

    setSaving(false);
  };

  const handleClear = () => {
    navigate('/exchange');
    setLastSaved(null);
    setForm({
      voucher_date: today,
      mobile: '',
      customer_name: '',
      customer_id: null,
      rate_per_gram: latestRate?.rate_24k || '',
      pure_touch: defaultPureTouch,
      remarks: '',
      ob_exchange_gold: 0,
      ob_exchange_cash: 0,
      ob_gold: 0,
      ob_cash: 0,
      ob_items: [],
      ob_last_voucher: null,
      ob_last_date: null,
      ob_tx_type: null,
    });
    setItems([{ ...EMPTY_ROW }]);
    setSettle({
      mode: 'purchase',
      cash_gold: '',
      use_ob: true,
      use_ob_cash: true,
      cash_given: ''
    });
    setMsg(null);
    exchangeAPI.getNextNo().then(no => setVoucherNo(no)).catch(() => {});
  };

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="page-title">EXCHANGE VOUCHER</div>
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 700,
              fontSize: 17,
              color: 'var(--gold-dark)',
              background: 'var(--bg-card2)',
              border: '1.5px solid var(--border-focus)',
              borderRadius: 6,
              padding: '4px 14px',
              letterSpacing: 2,
            }}
          >
            #{voucherNo}
          </div>
        </div>
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

      <div className="card">
        <div className="form-grid form-grid-4">
          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              value={form.voucher_date}
              onChange={e => upForm('voucher_date', e.target.value)}
            />
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
            <input
              type="text"
              value={form.customer_name}
              onChange={e => upForm('customer_name', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>24K Rate (₹/gram)</label>
            <input
              type="number"
              step="0.01"
              value={form.rate_per_gram}
              onChange={e => upForm('rate_per_gram', e.target.value)}
              className="highlight"
            />
          </div>
        </div>

        {(form.customer_id || obGold !== 0 || obCash !== 0 || generalObGold !== 0 || generalObCash !== 0 || (form.ob_items || []).length > 0) && (
          <div
            style={{
              marginTop: 14,
              background: 'linear-gradient(90deg, #F7F4EC, #EFE7D6)',
              border: '1.5px solid rgba(120,100,60,0.18)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '10px 16px',
                borderBottom: '1px dashed rgba(120,100,60,0.18)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1,
                color: 'var(--text-muted)',
                textTransform: 'uppercase'
              }}
            >
              Opening Balance Summary
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 14,
                padding: '14px 16px'
              }}
            >
              <div
                style={{
                  background: 'rgba(184,134,11,0.06)',
                  border: '1px solid rgba(184,134,11,0.18)',
                  borderRadius: 8,
                  overflow: 'hidden'
                }}
              >
                <div style={{ padding: '12px 14px' }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--gold-dark)',
                      marginBottom: 10,
                      textTransform: 'uppercase',
                      letterSpacing: 0.8
                    }}
                  >
                    OB Gold
                  </div>
                </div>

                {(form.ob_items || []).length > 0 && (
                  <div
                    style={{
                      borderTop: '1px dashed rgba(184,134,11,0.22)',
                      borderBottom: '1px dashed rgba(184,134,11,0.22)',
                      background: 'rgba(184,50,50,0.04)',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6
                    }}
                  >
                    {(form.ob_items || []).map((item, idx) => (
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
                        <strong
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontWeight: 700,
                            fontSize: 14,
                            color: 'var(--red)',
                            minWidth: 90,
                          }}
                        >
                          −{parseFloat(item.ob_amount || 0).toFixed(3)} g
                        </strong>

                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: 4,
                            background: 'rgba(184,50,50,0.12)',
                            color: 'var(--red)',
                          }}
                        >
                          SALES OB
                        </span>

                        <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>—</span>

                        <span
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontWeight: 600,
                            fontSize: 12,
                            color: 'var(--gold-dark)',
                          }}
                        >
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

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px 0',
                        marginTop: 2,
                        borderTop: '1.5px solid rgba(184,50,50,0.22)',
                        fontSize: 13,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          color: 'var(--red)',
                          letterSpacing: 0.5,
                        }}
                      >
                        {(form.ob_items || []).length > 1
                          ? `TOTAL SALES OB (${(form.ob_items || []).length} vouchers)`
                          : 'TOTAL SALES OB'}
                      </span>
                      <strong
                        style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 700,
                          fontSize: 15,
                          color: 'var(--red)',
                        }}
                      >
                        −{obGold.toFixed(3)} g
                      </strong>
                    </div>
                  </div>
                )}

                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>General OB Gold</span>
                    <strong style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--gold-dark)' }}>
                      {generalObGold.toFixed(3)} g
                    </strong>
                  </div>

                  <div
                    style={{
                      height: 1,
                      background: 'rgba(184,134,11,0.18)',
                      margin: '8px 0'
                    }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold-dark)' }}>
                      Total Gold OB
                    </span>
                    <strong
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 16,
                        color: 'var(--gold-dark)'
                      }}
                    >
                      {totalObGold.toFixed(3)} g
                    </strong>
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(26,80,128,0.06)',
                  border: '1px solid rgba(26,80,128,0.18)',
                  borderRadius: 8,
                  padding: '12px 14px'
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--blue)',
                    marginBottom: 10,
                    textTransform: 'uppercase',
                    letterSpacing: 0.8
                  }}
                >
                  OB Cash
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>General OB Cash</span>
                  <strong style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--blue)' }}>
                    ₹{generalObCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>

                <div
                  style={{
                    height: 1,
                    background: 'rgba(26,80,128,0.18)',
                    margin: '8px 0'
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)' }}>Total Cash OB</span>
                  <strong
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 16,
                      color: 'var(--blue)'
                    }}
                  >
                    ₹{totalObCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex-between mb-12">
          <div className="card-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
            Gold Items Received
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setItems(p => [...p, { ...EMPTY_ROW }])}>
            + Add Row
          </button>
        </div>

        <div className="table-container">
          <table className="item-table">
            <thead>
              <tr>
                <th style={{ width: 42 }}>S.No</th>
                <th style={{ width: 110 }}>Token No</th>
                <th className="right" style={{ width: 120 }}>Katcha Wt (g)</th>
                <th className="right" style={{ width: 110 }}>Katcha Touch</th>
                <th className="right" style={{ width: 100 }}>Less Touch</th>
                <th className="right" style={{ width: 120 }}>Balance Touch</th>
                <th className="right" style={{ width: 120 }}>Pure Wt (g)</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, idx) => (
                <tr key={idx}>
                  <td className="text-center text-muted" style={{ fontSize: 12 }}>{idx + 1}</td>
                  <td>
                    <input
                      type="text"
                      value={row.token_no}
                      onChange={e => upItem(idx, 'token_no', e.target.value)}
                      style={{ minWidth: 90 }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={row.katcha_wt}
                      onChange={e => upItem(idx, 'katcha_wt', e.target.value)}
                      style={{ textAlign: 'right', minWidth: 96, ...monoStyle }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={row.katcha_touch}
                      onChange={e => upItem(idx, 'katcha_touch', e.target.value)}
                      style={{ textAlign: 'right', minWidth: 88, ...monoStyle }}
                      className="highlight"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.less_touch}
                      onChange={e => upItem(idx, 'less_touch', e.target.value)}
                      style={{ textAlign: 'right', minWidth: 80, ...monoStyle }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      readOnly
                      value={row.balance_touch}
                      style={{
                        textAlign: 'right',
                        minWidth: 96,
                        ...monoStyle,
                        color: 'var(--gold-dark)',
                        background: '#F5F1E6',
                        border: 'none',
                        borderBottom: '1.5px solid var(--border)',
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.001"
                      readOnly
                      value={row.pure_wt}
                      style={{
                        textAlign: 'right',
                        minWidth: 96,
                        ...monoStyle,
                        color: 'var(--green)',
                        background: '#F0FAF4',
                        border: 'none',
                        borderBottom: '1.5px solid rgba(26,110,64,0.3)',
                      }}
                    />
                  </td>
                  <td>
                    <button
                      className="btn btn-danger btn-xs"
                      onClick={() => { if (items.length > 1) setItems(p => p.filter((_, i) => i !== idx)); }}
                      disabled={items.length === 1}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} style={{ textAlign: 'right', fontSize: 11, letterSpacing: 1 }}>TOTAL</td>
                <td className="right">{totalKatcha > 0 ? totalKatcha.toFixed(3) : '—'}</td>
                <td colSpan={3}></td>
                <td className="right" style={{ color: 'var(--green)' }}>
                  {totalPureRaw > 0 ? totalPureRaw.toFixed(2) : '—'}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {items.some(r => r.balance_touch && r.katcha_wt) && (
          <div
            style={{
              marginTop: 10,
              padding: '7px 12px',
              background: '#FAFAF0',
              border: '1px solid var(--border)',
              borderRadius: 4,
              fontSize: 12,
              color: 'var(--text-muted)',
              lineHeight: 2.2,
            }}
          >
            {items.filter(r => r.katcha_wt && r.balance_touch).map((r, i) => (
              <span key={i} style={{ marginRight: 20 }}>
                Row {i + 1}:{' '}
                <strong style={{ color: 'var(--gold-dark)' }}>
                  {parseFloat(r.katcha_wt).toFixed(3)}g × {r.balance_touch}% ÷ 100
                </strong>
                {' = '}
                <strong style={{ color: 'var(--green)' }}>
                  {parseFloat(r.pure_wt || 0).toFixed(2)}g
                </strong>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-title">Settlement</div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <label style={{ textTransform: 'none', fontSize: 13, fontWeight: 600, color: 'var(--text-sub)', whiteSpace: 'nowrap' }}>
              Pure Touch
            </label>
            <input
              type="number"
              step="0.01"
              value={form.pure_touch}
              onChange={e => upForm('pure_touch', e.target.value)}
              style={{ width: 90, ...monoStyle, textAlign: 'right' }}
              className="highlight"
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>%</span>
          </div>

          <div
            style={{
              background: 'linear-gradient(135deg, #F8F3E6, #F2EAD5)',
              border: '2px solid rgba(184,134,11,0.35)',
              borderRadius: 8,
              marginBottom: 14,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 18px',
                background: 'rgba(184,134,11,0.06)',
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: 'var(--gold-dark)', textTransform: 'uppercase', marginBottom: 3 }}>
                  {appliedObGold !== 0 ? 'Net Pure Gold Due' : 'Total Pure Gold Due'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {`Raw ${totalPureRaw.toFixed(3)}g − OB Gold ${appliedObGold.toFixed(3)}g`}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ ...monoStyle, fontSize: 30, color: 'var(--gold-dark)', lineHeight: 1, textAlign: 'right' }}>
                  {netPureOwed.toFixed(2)}
                  <span style={{ fontSize: 14, marginLeft: 4, fontWeight: 400, color: 'var(--text-muted)' }}>g</span>
                </div>
                <button
                  onClick={() => setSettle(s => ({ ...s, cash_gold: netPureOwed.toFixed(3) }))}
                  style={{
                    background: 'var(--gold-dark)',
                    color: '#FFF5D6',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontFamily: 'Inter,sans-serif',
                    fontWeight: 600,
                    fontSize: 11,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    lineHeight: 1.4,
                  }}
                >
                  Use ↓
                </button>
              </div>
            </div>

            {(totalObGold > 0 || totalObCash > 0) && (
              <div
                style={{
                  padding: '12px 18px',
                  borderTop: '1px dashed rgba(184,134,11,0.3)',
                  background: '#FCFAF4',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Opening Balance Usage in Settlement
                </div>

                {totalObGold > 0 && (
                  <div
                    style={{
                      padding: '10px 18px',
                      borderTop: '1px dashed rgba(184,134,11,0.3)',
                      background: settle.use_ob ? 'rgba(184,50,50,0.04)' : 'rgba(26,110,64,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: settle.use_ob ? 'var(--red)' : 'var(--green)' }}>
                        {settle.use_ob
                          ? `✓ Total OB Gold −${totalObGold.toFixed(3)}g deducted this transaction`
                          : `⏭ Total OB Gold ${totalObGold.toFixed(3)}g skipped — carry to next transaction`}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {settle.use_ob
                          ? 'Customer agreed to deduct opening gold balance now'
                          : 'Customer said: deduct opening gold balance next time'}
                      </div>
                    </div>
                    <button
                      onClick={() => setSettle(s => ({ ...s, use_ob: !s.use_ob, cash_gold: '' }))}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 6,
                        flexShrink: 0,
                        fontFamily: 'Inter,sans-serif',
                        fontWeight: 700,
                        fontSize: 11,
                        cursor: 'pointer',
                        border: '1.5px solid',
                        background: settle.use_ob ? '#fff' : 'rgba(26,110,64,0.08)',
                        borderColor: settle.use_ob ? 'rgba(184,50,50,0.4)' : 'rgba(26,110,64,0.4)',
                        color: settle.use_ob ? 'var(--red)' : 'var(--green)',
                      }}
                    >
                      {settle.use_ob ? 'Skip OB →' : '← Apply OB'}
                    </button>
                  </div>
                )}

                {totalObCash > 0 && (
                  <div
                    style={{
                      padding: '10px 18px',
                      borderTop: '1px dashed rgba(26,80,128,0.22)',
                      background: settle.use_ob_cash ? 'rgba(26,80,128,0.05)' : 'rgba(26,110,64,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: settle.use_ob_cash ? 'var(--blue)' : 'var(--green)' }}>
                        {settle.use_ob_cash
                          ? `✓ Total OB Cash ₹${totalObCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })} applied in this transaction`
                          : `⏭ Total OB Cash ₹${totalObCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })} skipped — carry to next transaction`}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {settle.use_ob_cash
                          ? 'Customer agreed to use opening cash balance now'
                          : 'Customer said: use opening cash balance next time'}
                      </div>
                    </div>
                    <button
                      onClick={() => setSettle(s => ({ ...s, use_ob_cash: !s.use_ob_cash }))}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 6,
                        flexShrink: 0,
                        fontFamily: 'Inter,sans-serif',
                        fontWeight: 700,
                        fontSize: 11,
                        cursor: 'pointer',
                        border: '1.5px solid',
                        background: settle.use_ob_cash ? '#fff' : 'rgba(26,110,64,0.08)',
                        borderColor: settle.use_ob_cash ? 'rgba(26,80,128,0.35)' : 'rgba(26,110,64,0.4)',
                        color: settle.use_ob_cash ? 'var(--blue)' : 'var(--green)',
                      }}
                    >
                      {settle.use_ob_cash ? 'Skip Cash OB →' : '← Apply Cash OB'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 180px',
              gap: 12,
              alignItems: 'end',
              marginBottom: 14,
            }}
          >
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Pure Gold Given to Customer (g)</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={settle.cash_gold}
                onChange={e => setSettle(s => ({ ...s, cash_gold: e.target.value }))}
                className="highlight"
                style={{ ...monoStyle, fontSize: 16 }}
                placeholder={`Owed: ${netPureOwed.toFixed(2)}g`}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Settlement Type</label>
              <select
                value={settle.mode}
                onChange={e =>
                  setSettle(s => ({
                    ...s,
                    mode: e.target.value,
                    cash_given: ''
                  }))
                }
                className="highlight"
              >
                <option value="sales">Sales</option>
                <option value="purchase">Purchase</option>
              </select>
            </div>
          </div>

          {settle.cash_gold !== '' && (
            <div
              style={{
                borderRadius: 7,
                marginBottom: 12,
                overflow: 'hidden',
                border: `1.5px solid ${isNil ? 'rgba(26,110,64,0.3)' : isSales ? 'rgba(26,80,128,0.3)' : 'rgba(184,134,11,0.4)'}`,
              }}
            >
              <div
                style={{
                  padding: '9px 14px',
                  background: isNil ? 'rgba(26,110,64,0.1)' : isSales ? 'rgba(26,80,128,0.1)' : 'rgba(184,134,11,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 18 }}>{isNil ? '✓' : isSales ? '📤' : '📥'}</span>
                <strong style={{ fontSize: 14, fontWeight: 700, color: isNil ? 'var(--green)' : isSales ? 'var(--blue)' : 'var(--gold-dark)' }}>
                  {isNil
                    ? (purchaseCashSettled && extraCash > 0 ? 'Transaction NIL — Settled with Extra Cash' : 'Transaction NIL — Balanced')
                    : isSales
                    ? 'SALES — Extra Gold Given'
                    : 'PURCHASE — Less Gold Given'}
                </strong>
              </div>

              <div style={{ padding: '10px 14px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {isNil && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {purchaseCashSettled ? (
                        <>
                          Gold given: <strong style={{ ...monoStyle, color: 'var(--gold-dark)' }}>{cashGold.toFixed(3)}g</strong>
                          {' + '}
                          Cash: <strong style={{ ...monoStyle, color: 'var(--green)' }}>₹{cashGiven.toLocaleString('en-IN')}</strong>
                          {' — Fully settled. No OB carried forward.'}
                        </>
                      ) : extraGold > 0 ? (
                        <>
                          Customer receives <strong style={{ ...monoStyle, color: 'var(--green)' }}>{cashGold.toFixed(3)}g</strong>.
                          Extra gold balance: <strong style={{ ...monoStyle, color: 'var(--blue)' }}>{extraGold.toFixed(3)}g</strong>
                        </>
                      ) : pendingGold > 0 ? (
                        <>
                          Customer receives <strong style={{ ...monoStyle, color: 'var(--gold-dark)' }}>{cashGold.toFixed(3)}g</strong>.
                          Pending balance: <strong style={{ ...monoStyle, color: 'var(--red)' }}>{pendingGold.toFixed(3)}g</strong>
                        </>
                      ) : (
                        <>
                          Customer receives exactly <strong style={{ ...monoStyle, color: 'var(--green)' }}>{cashGold.toFixed(3)}g</strong>. No balance pending.
                        </>
                      )}
                    </div>

                    {extraGold > 0 && !purchaseCashSettled && (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 13,
                          padding: '6px 10px',
                          borderRadius: 5,
                          background: 'rgba(26,80,128,0.06)',
                          border: '1px solid rgba(26,80,128,0.25)',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Extra Gold Balance</span>
                        <span style={{ ...monoStyle, fontWeight: 700, color: 'var(--blue)' }}>
                          +{extraGold.toFixed(3)} g
                        </span>
                      </div>
                    )}

                    {purchaseCashSettled && (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 13,
                          padding: '6px 10px',
                          borderRadius: 5,
                          background: extraCash > 0 ? 'rgba(184,50,50,0.06)' : 'rgba(26,110,64,0.06)',
                          border: `1px solid ${extraCash > 0 ? 'rgba(184,50,50,0.25)' : 'rgba(26,110,64,0.25)'}`,
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
                          {extraCash > 0 ? 'Extra cash given' : 'Cash settlement'}
                        </span>
                        <span
                          style={{
                            ...monoStyle,
                            fontWeight: 700,
                            color: extraCash > 0 ? 'var(--red)' : 'var(--green)'
                          }}
                        >
                          {extraCash > 0 ? `₹${extraCash.toLocaleString('en-IN')}` : '₹0'}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {isSales && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Gold owed to customer</span>
                      <span style={{ ...monoStyle }}>{netPureOwed.toFixed(2)} g</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Gold given</span>
                      <span style={{ ...monoStyle, color: 'var(--blue)' }}>{cashGold.toFixed(3)} g</span>
                    </div>
                    <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                      <span style={{ fontWeight: 600, color: 'var(--blue)' }}>Extra gold (→ Sales OB)</span>
                      <span style={{ ...monoStyle, fontWeight: 700, color: 'var(--blue)', fontSize: 15 }}>
                        +{extraGold.toFixed(3)} g
                      </span>
                    </div>
                  </>
                )}

                {showPurchaseCashInput && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Gold owed to customer</span>
                      <span style={{ ...monoStyle }}>{netPureOwed.toFixed(2)} g</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Gold given</span>
                      <span style={{ ...monoStyle }}>{cashGold.toFixed(3)} g</span>
                    </div>
                    <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Pending gold</span>
                      <span style={{ ...monoStyle, color: 'var(--red)' }}>{pendingGold.toFixed(3)} g</span>
                    </div>

                    {rate > 0 && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ color: 'var(--text-muted)' }}>@ ₹{rate}/g</span>
                          <span style={{ ...monoStyle }}>₹{cashForPurchase.toFixed(2)}</span>
                        </div>

                        {totalObCash !== 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: 'var(--text-muted)' }}>
                              Total OB Cash {settle.use_ob_cash ? '(Applied)' : '(Skipped)'}
                            </span>
                            <span style={{ ...monoStyle, color: settle.use_ob_cash ? 'var(--blue)' : 'var(--text-muted)' }}>
                              {settle.use_ob_cash ? `₹${appliedObCash.toFixed(2)}` : '₹0.00'}
                            </span>
                          </div>
                        )}

                        <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, color: 'var(--gold-dark)', fontSize: 13 }}>
                            Cash to pay (rounded)
                          </span>
                          <span style={{ ...monoStyle, fontWeight: 700, color: 'var(--gold-dark)', fontSize: 20 }}>
                            ₹{cashRounded.toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-sub)', fontSize: 13, whiteSpace: 'nowrap' }}>
                            Cash Given to Customer (₹)
                          </span>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={settle.cash_given}
                            onChange={e => setSettle(s => ({ ...s, cash_given: e.target.value }))}
                            placeholder={`e.g. ${cashRounded.toLocaleString('en-IN')}`}
                            style={{ flex: 1, ...monoStyle, fontSize: 15, textAlign: 'right', padding: '5px 9px' }}
                            className="highlight"
                          />
                        </div>

                        {cashGiven > 0 && (
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '6px 10px',
                              borderRadius: 5,
                              marginTop: 4,
                              background: pendingCash < 1 && extraCash < 1
                                ? 'rgba(26,110,64,0.06)'
                                : pendingCash > 0
                                ? 'rgba(26,80,128,0.06)'
                                : 'rgba(184,50,50,0.06)',
                              border: `1px solid ${
                                pendingCash < 1 && extraCash < 1
                                  ? 'rgba(26,110,64,0.25)'
                                  : pendingCash > 0
                                  ? 'rgba(26,80,128,0.2)'
                                  : 'rgba(184,50,50,0.25)'
                              }`,
                            }}
                          >
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                              {pendingCash < 1 && extraCash < 1
                                ? '✓ Cash settled'
                                : pendingCash > 0
                                ? 'Cash balance pending'
                                : 'Extra cash given'}
                            </span>
                            <span
                              style={{
                                ...monoStyle,
                                fontSize: 14,
                                fontWeight: 700,
                                color: pendingCash < 1 && extraCash < 1
                                  ? 'var(--green)'
                                  : pendingCash > 0
                                  ? 'var(--blue)'
                                  : 'var(--red)',
                              }}
                            >
                              {pendingCash < 1 && extraCash < 1
                                ? '₹0'
                                : pendingCash > 0
                                ? `₹${pendingCash.toLocaleString('en-IN')}`
                                : `₹${extraCash.toLocaleString('en-IN')}`}
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

        <div className="card">
          <div className="card-title">Summary</div>
          <div className="calc-box">
            <div className="calc-row">
              <span className="calc-label">Total Katcha Weight</span>
              <span className="calc-value">{totalKatcha.toFixed(3)} g</span>
            </div>
            <div className="calc-row">
              <span className="calc-label">Total Pure (raw)</span>
              <span className="calc-value">{totalPureRaw.toFixed(2)} g</span>
            </div>
            <div className="calc-row">
              <span className="calc-label">Pure Gold Given × {pureTouchVal}%</span>
              <span className="calc-value" style={{ color: 'var(--green)' }}>
                {actualPureGold.toFixed(3)} g
              </span>
            </div>

            {totalObGold !== 0 && (
              <div className="calc-row">
                <span className="calc-label">
                  Total OB Gold {settle.use_ob ? '(Applied)' : '(Skipped)'}
                </span>
                <span
                  className="calc-value"
                  style={{ color: settle.use_ob ? 'var(--gold-dark)' : 'var(--text-muted)' }}
                >
                  {settle.use_ob ? `−${totalObGold.toFixed(3)} g` : '0.000 g'}
                </span>
              </div>
            )}

            <div className="calc-row total">
              <span className="calc-label">NET PURE OWED</span>
              <span className="calc-value big">{netPureOwed.toFixed(3)} g</span>
            </div>
          </div>

          {settle.cash_gold !== '' && (
            <div className="calc-box" style={{ marginTop: 10 }}>
              <div className="calc-row">
                <span className="calc-label">Gold Given</span>
                <span className="calc-value">{cashGold.toFixed(3)} g</span>
              </div>

              {isSales && (
                <div className="calc-row">
                  <span className="calc-label">Extra (→ Sales OB)</span>
                  <span className="calc-value" style={{ color: 'var(--blue)' }}>+{extraGold.toFixed(3)} g</span>
                </div>
              )}

              {showPurchaseCashInput && (
                <>
                  <div className="calc-row">
                    <span className="calc-label">Pending Gold</span>
                    <span className="calc-value" style={{ color: 'var(--red)' }}>{pendingGold.toFixed(3)} g</span>
                  </div>
                  <div className="calc-row">
                    <span className="calc-label">Cash equivalent</span>
                    <span className="calc-value">₹{cashForPurchase.toFixed(2)}</span>
                  </div>

                  {totalObCash !== 0 && (
                    <div className="calc-row">
                      <span className="calc-label">
                        Total OB Cash {settle.use_ob_cash ? '(Applied)' : '(Skipped)'}
                      </span>
                      <span
                        className="calc-value"
                        style={{ color: settle.use_ob_cash ? 'var(--blue)' : 'var(--text-muted)' }}
                      >
                        {settle.use_ob_cash
                          ? `₹${appliedObCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                          : '₹0.00'}
                      </span>
                    </div>
                  )}

                  <div className="calc-row total">
                    <span className="calc-label">CASH TO PAY (rounded)</span>
                    <span className="calc-value big" style={{ color: 'var(--gold-dark)' }}>
                      ₹{cashRounded.toLocaleString('en-IN')}
                    </span>
                  </div>

                  {cashGiven > 0 && (
                    <>
                      <div className="calc-row">
                        <span className="calc-label">Cash Given</span>
                        <span className="calc-value" style={{ color: 'var(--green)' }}>
                          ₹{cashGiven.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="calc-row total">
                        <span className="calc-label">
                          {pendingCash < 1 && extraCash < 1
                            ? 'CASH SETTLED ✓'
                            : pendingCash > 0
                            ? 'CASH PENDING'
                            : 'EXTRA CASH GIVEN'}
                        </span>
                        <span
                          className="calc-value big"
                          style={{
                            color: pendingCash < 1 && extraCash < 1
                              ? 'var(--green)'
                              : pendingCash > 0
                              ? 'var(--blue)'
                              : 'var(--red)'
                          }}
                        >
                          {pendingCash < 1 && extraCash < 1
                            ? '₹0'
                            : pendingCash > 0
                            ? `₹${pendingCash.toLocaleString('en-IN')}`
                            : `₹${extraCash.toLocaleString('en-IN')}`}
                        </span>
                      </div>
                    </>
                  )}
                </>
              )}

              {isNil && (
  <div className="calc-row total">
    <span className="calc-label">BALANCE</span>
    <span
      className="calc-value big"
      style={{
        color: extraGold > 0 ? 'var(--blue)' : 'var(--green)'
      }}
    >
      {extraGold > 0
        ? `+${extraGold.toFixed(3)} g`
        : '0.000 g ✓'}
    </span>
  </div>
)}
            </div>
          )}

          {totalObCash !== 0 && (
            <div
              style={{
                marginTop: 10,
                padding: '8px 14px',
                borderRadius: 6,
                fontSize: 13,
                background: 'rgba(26,80,128,0.05)',
                border: '1px solid rgba(26,80,128,0.18)',
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>Total OB Cash: </span>
              <strong style={{ ...monoStyle, color: 'var(--blue)' }}>
                ₹{totalObCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </strong>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 4 }}>
        {msg?.type === 'success' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '12px 18px',
              marginBottom: 8,
              borderRadius: 7,
              background: 'rgba(26,110,64,0.09)',
              border: '1.5px solid rgba(26,110,64,0.35)',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--green)', fontSize: 13 }}>
              ✓ {msg.text}
            </span>
            {lastSaved && (
              <button
                onClick={() => setLastSaved(s => ({ ...s, _showPrint: true }))}
                style={{
                  background: '#6B4A00',
                  color: '#FFF5D6',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                🖨 Print Receipt
              </button>
            )}
          </div>
        )}

        <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={handleClear}>Clear</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : '✦ Save Exchange Voucher'}
          </button>
        </div>
      </div>

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