// client/src/pages/StockReport.jsx
import React, { useState, useEffect } from 'react';
import { stockAPI, rateAPI } from '../db/api';
import { fmtDate } from '../db/utils';

export default function StockReport() {
  const [goldLedger, setGoldLedger] = useState([]);
  const [cashLedger, setCashLedger] = useState([]);
  const [bankLedger, setBankLedger] = useState([]);
  const [currentStock, setCurrentStock] = useState(0);
  const [latestRate, setLatestRate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('gold'); // 'gold' | 'cash' | 'bank'
  const [filters, setFilters] = useState({
    date_from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
    ref_type: '',
  });

  useEffect(() => { loadData(); }, []);
const [masterStock, setMasterStock] = useState(0);
const [masterInput, setMasterInput] = useState('');

const [masterCash, setMasterCash] = useState(0);
const [masterCashInput, setMasterCashInput] = useState('');

const loadData = async (f = filters) => {
  setLoading(true);
  try {
    const goldRows = await stockAPI.getLedger(f).catch(() => []);
    const cashRows = await stockAPI.getCash(f).catch(() => []);
    const bankRows = await stockAPI.getBank(f).catch(() => []);
    const stock = await stockAPI.getCurrent().catch(() => ({ balance: 0 }));
    const rate = await rateAPI.getLatest().catch(() => null);
   const master = await stockAPI.getMaster().catch(() => ({
  opening_gold_stock: 0,
  opening_cash_balance: 0
}));

    setGoldLedger(Array.isArray(goldRows) ? goldRows : []);
    setCashLedger(Array.isArray(cashRows) ? cashRows : []);
    setBankLedger(Array.isArray(bankRows) ? bankRows : []);
    setCurrentStock(parseFloat(stock?.balance || 0));
    setLatestRate(rate || null);
   setMasterStock(parseFloat(master?.opening_gold_stock || 0));
setMasterInput(parseFloat(master?.opening_gold_stock || 0).toFixed(3));

setMasterCash(parseFloat(master?.opening_cash_balance || 0));
setMasterCashInput(parseFloat(master?.opening_cash_balance || 0).toFixed(2));
  } catch (e) {
    console.error('Stock report load failed:', e);
  } finally {
    setLoading(false);
  }
};
  const goldIn = goldLedger.reduce((s, e) => s + (parseFloat(e.dr_pure_wt) || 0), 0);
  const goldOut = goldLedger.reduce((s, e) => s + (parseFloat(e.cr_pure_wt) || 0), 0);
  const cashIn = cashLedger.filter(r => r.entry_type === 'IN').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const cashOut = cashLedger.filter(r => r.entry_type === 'OUT').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const bankIn = bankLedger.filter(r => r.entry_type === 'IN').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const bankOut = bankLedger.filter(r => r.entry_type === 'OUT').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const rate = parseFloat(latestRate?.rate_24k) || 0;
  const monoStyle = { fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 };
  const displayStock = masterStock + (goldIn - goldOut);

  const displayCash = masterCash + (cashIn - cashOut);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">STOCK</div>
        <button className="btn btn-secondary no-print" onClick={() => window.print()}>Print</button>
      </div>
     

      {/* Summary cards */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderColor: 'rgba(26,110,64,0.3)' }}>
          <div className="stat-icon" style={{ color: 'var(--green)' }}>⬡</div>
<div className="stat-value" style={{ color: 'var(--green)', ...monoStyle }}>
  {displayStock.toFixed(3)}g
</div>
<div className="stat-label">Gold Stock IN Hand</div>
{rate > 0 && (
  <div className="stat-sub">
    ≈ ₹{(displayStock * rate).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
  </div>
)}
<div className="stat-sub">
  Master: {masterStock.toFixed(3)}g
</div>

        </div>
        <div className="stat-card" style={{ borderColor: 'rgba(26,110,64,0.2)' }}>
          <div className="stat-icon" style={{ color: 'var(--green)' }}>↓ IN</div>
          <div className="stat-value" style={{ color: 'var(--green)', ...monoStyle }}>{goldIn.toFixed(3)}g</div>
          <div className="stat-label">Gold Stock In</div>
        </div>
        <div className="stat-card" style={{ borderColor: 'rgba(184,50,50,0.2)' }}>
          <div className="stat-icon" style={{ color: 'var(--red)' }}>↑ OUT</div>
          <div className="stat-value" style={{ color: 'var(--red)', ...monoStyle }}>{goldOut.toFixed(3)}g</div>
          <div className="stat-label">Gold Stock Out</div>
        </div>
        <div className="stat-card" style={{ borderColor: 'rgba(26,80,128,0.2)' }}>
  <div className="stat-icon" style={{ color: 'var(--blue)' }}>₹</div>
  <div className="stat-value" style={{ color: 'var(--blue)', ...monoStyle }}>
    ₹{displayCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
  </div>
  <div className="stat-label">Cash In Hand</div>
  <div className="stat-sub">
    In: ₹{cashIn.toLocaleString('en-IN', { maximumFractionDigits: 0 })} / Out: ₹{cashOut.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
  </div>
  <div className="stat-sub">
    Master: ₹{masterCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
  </div>
</div>
        <div className="stat-card" style={{ borderColor: 'rgba(120,70,180,0.2)' }}>
          <div className="stat-icon" style={{ color: '#7C4DFF' }}>🏦</div>
          <div className="stat-value" style={{ color: '#7C4DFF', ...monoStyle }}>
            ₹{(bankIn - bankOut).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="stat-label">Bank Net Balance</div>
          <div className="stat-sub">
            In: ₹{bankIn.toLocaleString('en-IN', { maximumFractionDigits: 0 })} / Out: ₹{bankOut.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>
     <div className="card no-print" style={{ marginBottom: 12 }}>
  <div style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 16
  }}>
    {/* Master Gold */}
    <div style={{
      border: '1px solid rgba(184,134,11,0.18)',
      borderRadius: 8,
      padding: 14,
      background: 'rgba(184,134,11,0.04)'
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold-dark)', marginBottom: 4 }}>
        Master Gold Stock
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
        Enter opening / manual gold stock in hand
      </div>

      <div style={{ display: 'flex', alignItems: 'end', gap: 8 }}>
        <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
          <label>Gold Stock (g)</label>
          <input
            type="number"
            step="0.001"
            value={masterInput}
            onChange={e => setMasterInput(e.target.value)}
            style={{ width: '100%', ...monoStyle, textAlign: 'right' }}
          />
        </div>

        <button
          className="btn btn-primary"
          onClick={async () => {
            try {
              await stockAPI.updateMaster({
                opening_gold_stock: masterInput,
                opening_cash_balance: masterCashInput
              });
              await loadData(filters);
            } catch (e) {
              console.error('Failed to save gold master:', e);
            }
          }}
        >
          Save Gold
        </button>
      </div>
    </div>

    {/* Master Cash */}
    <div style={{
      border: '1px solid rgba(26,80,128,0.18)',
      borderRadius: 8,
      padding: 14,
      background: 'rgba(26,80,128,0.04)'
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)', marginBottom: 4 }}>
        Master Cash In Hand
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
        Enter opening / manual cash balance in hand
      </div>

      <div style={{ display: 'flex', alignItems: 'end', gap: 8 }}>
        <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
          <label>Cash Balance (₹)</label>
          <input
            type="number"
            step="0.01"
            value={masterCashInput}
            onChange={e => setMasterCashInput(e.target.value)}
            style={{ width: '100%', ...monoStyle, textAlign: 'right' }}
          />
        </div>

        <button
          className="btn btn-primary"
          onClick={async () => {
            try {
              await stockAPI.updateMaster({
                opening_gold_stock: masterInput,
                opening_cash_balance: masterCashInput
              });
              await loadData(filters);
            } catch (e) {
              console.error('Failed to save cash master:', e);
            }
          }}
        >
          Save Cash
        </button>
      </div>
    </div>
  </div>
</div>

      {/* Filters */}
            <div className="card no-print">
        <div className="filter-bar" style={{ marginBottom: 0 }}>
          <div className="form-group">
            <label>From Date</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label>To Date</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label>
              {tab === 'gold' ? 'Gold Type' : tab === 'cash' ? 'Cash Source' : 'Bank Source'}
            </label>
            <select
              value={filters.ref_type}
              onChange={e => setFilters(f => ({ ...f, ref_type: e.target.value }))}
            >
              <option value="">All</option>
              <option value="exchange">Exchange</option>
              <option value="sales">Sales</option>
              <option value="purchase">Purchase</option>
              {tab === 'gold' && <option value="processing">Processing</option>}
              {tab === 'gold' && <option value="gold_entry">Gold Entry</option>}
            </select>
          </div>

          <div className="form-group" style={{ paddingTop: 20, display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => loadData(filters)}>
              Apply Filter
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                const reset = {
                  date_from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
                  date_to: new Date().toISOString().split('T')[0],
                  ref_type: '',
                };
                setFilters(reset);
                loadData(reset);
              }}
            >
              Reset
            </button>
          </div>
        </div>

        <div style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: '1px dashed var(--border)',
          fontSize: 12,
          color: 'var(--text-muted)',
          display: 'flex',
          gap: 18,
          flexWrap: 'wrap'
        }}>
          <span><strong>From:</strong> {filters.date_from || '—'}</span>
          <span><strong>To:</strong> {filters.date_to || '—'}</span>
          <span><strong>Type:</strong> {filters.ref_type || 'All'}</span>
          <span><strong>View:</strong> {tab === 'gold' ? 'Gold Statement' : tab === 'cash' ? 'Cash Statement' : 'Bank Statement'}</span>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 0, borderBottom: '2px solid var(--border)' }}>
        {['gold', 'cash', 'bank'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 24px', background: 'none', border: 'none',
            borderBottom: tab === t ? '3px solid var(--gold-accent)' : '3px solid transparent',
            color: tab === t ? 'var(--gold-dark)' : 'var(--text-muted)',
            fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: 12.5, letterSpacing: 1.5,
            textTransform: 'uppercase', cursor: 'pointer', marginBottom: -2,
          }}>
            {t === 'gold' ? '⬡ Gold Statement' : t === 'cash' ? '₹ Cash Statement' : '🏦 Bank Statement'}
          </button>
        ))}
      </div>

      {/* Gold Statement */}
      {tab === 'gold' && (
        <div className="card" style={{ borderTopLeftRadius: 0 }}>
          <div className="card-title">Gold Stock Ledger (Pure 99.90)</div>
          {loading ? <p className="text-muted" style={{ padding: 12 }}>Loading...</p>
            : goldLedger.length === 0 ? <div className="empty-state"><div className="empty-icon">⬡</div><p>No gold entries for period</p></div>
              : (
                <div className="table-container">
                  <table>
                    <thead><tr>
                      <th>Date</th><th>Type</th><th>Reference</th><th>Description</th>
                      <th className="right" style={{ color: 'var(--green)' }}>Stock In (g)</th>
                      <th className="right" style={{ color: 'var(--red)' }}>Stock Out (g)</th>
                      <th className="right">Balance (g)</th>
                    </tr></thead>
                    <tbody>{goldLedger.map((e, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 12 }}>{fmtDate(e.entry_date)}</td>
                        <td><span className={`badge ${e.ref_type === 'exchange' ? 'badge-info'
: e.ref_type === 'sales' ? 'badge-warning'
: e.ref_type === 'purchase' ? 'badge-gold'
: e.ref_type === 'gold_entry' ? 'badge-success'
: 'badge-default'}`}>{e.ref_type === 'gold_entry' ? 'Gold Entry'
 : e.ref_type === 'exchange' ? 'Exchange'
 : e.ref_type === 'sales' ? 'Sales'
 : e.ref_type === 'purchase' ? 'Purchase'
 : e.ref_type}</span></td>
                        <td className="font-mono text-gold" style={{ fontSize: 12 }}>{e.ref_no || '—'}</td>
                        <td style={{ maxWidth: 240, fontSize: 12 }}>{e.description}</td>
                        <td className="right td-number text-green">{parseFloat(e.dr_pure_wt || 0) > 0 ? parseFloat(e.dr_pure_wt).toFixed(3) : '—'}</td>
                        <td className="right td-number text-red">{parseFloat(e.cr_pure_wt || 0) > 0 ? parseFloat(e.cr_pure_wt).toFixed(3) : '—'}</td>
                        <td className="right td-number" style={{ color: parseFloat(e.balance_pure_wt) >= 0 ? 'var(--gold-dark)' : 'var(--red)' }}>{parseFloat(e.balance_pure_wt || 0).toFixed(3)}</td>
                      </tr>
                    ))}</tbody>
                    <tfoot><tr>
                      <td colSpan={4}>PERIOD TOTAL</td>
                      <td className="right text-green">{goldIn.toFixed(3)}</td>
                      <td className="right text-red">{goldOut.toFixed(3)}</td>
                      <td className="right">{goldLedger.length > 0 ? parseFloat(goldLedger[goldLedger.length - 1].balance_pure_wt || 0).toFixed(3) : '0.000'}</td>
                    </tr></tfoot>
                  </table>
                </div>
              )}
        </div>
      )}

      {/* Cash Statement */}
      {tab === 'cash' && (
        <div className="card" style={{ borderTopLeftRadius: 0 }}>
          <div className="card-title">Cash Statement</div>
          {loading ? <p className="text-muted" style={{ padding: 12 }}>Loading...</p>
            : cashLedger.length === 0 ? <div className="empty-state"><div className="empty-icon">₹</div><p>No cash entries for period</p></div>
              : (
                <div className="table-container">
                  <table>
                    <thead><tr>
                      <th>Date</th><th>Reference</th><th>Customer</th><th>Source</th>
                      <th className="right" style={{ color: 'var(--green)' }}>Cash In (₹)</th>
                      <th className="right" style={{ color: 'var(--red)' }}>Cash Out (₹)</th>
                    </tr></thead>
                    <tbody>{cashLedger.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 12 }}>{fmtDate(r.entry_date)}</td>
                        <td className="font-mono text-gold" style={{ fontSize: 12 }}>{r.ref_no || '—'}</td>
                        <td style={{ fontSize: 13 }}>{r.customer_name || '—'}</td>
                        <td><span className={`badge ${r.source === 'exchange' ? 'badge-info' : 'badge-gold'}`}>{r.source}</span></td>
                        <td className="right td-number text-green">
                          {r.entry_type === 'IN'
                            ? `₹${parseFloat(r.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                            : '—'}
                        </td>
                        <td className="right td-number text-red">
                          {r.entry_type === 'OUT'
                            ? `₹${parseFloat(r.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                            : '—'}
                        </td>
                      </tr>
                    ))}</tbody>
                    <tfoot><tr>
                      <td colSpan={4}>PERIOD TOTAL</td>
                      <td className="right text-green">₹{cashIn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="right text-red">₹{cashOut.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr></tfoot>
                  </table>
                </div>
              )}
        </div>
      )}

      {/* Bank Statement */}
      {tab === 'bank' && (
        <div className="card" style={{ borderTopLeftRadius: 0 }}>
          <div className="card-title">Bank Statement</div>
          {loading ? <p className="text-muted" style={{ padding: 12 }}>Loading...</p>
            : bankLedger.length === 0 ? <div className="empty-state"><div className="empty-icon">🏦</div><p>No bank entries for period</p></div>
              : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Reference</th>
                        <th>Customer</th>
                        <th>Mode</th>
                        <th>Txn ID</th>
                        <th className="right" style={{ color: 'var(--green)' }}>Bank In (₹)</th>
                        <th className="right" style={{ color: 'var(--red)' }}>Bank Out (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bankLedger.map((r, i) => (
                        <tr key={i}>
                          <td style={{ fontSize: 12 }}>{fmtDate(r.entry_date)}</td>
                          <td className="font-mono text-gold" style={{ fontSize: 12 }}>{r.entry_no || '—'}</td>
                          <td style={{ fontSize: 13 }}>{r.customer_name || '—'}</td>
                          <td>{r.payment_mode || '—'}</td>
                          <td className="font-mono" style={{ fontSize: 12 }}>{r.transaction_id || '—'}</td>
                          <td className="right td-number text-green">
                            {r.entry_type === 'IN'
                              ? `₹${parseFloat(r.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                              : '—'}
                          </td>
                          <td className="right td-number text-red">
                            {r.entry_type === 'OUT'
                              ? `₹${parseFloat(r.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={5}>PERIOD TOTAL</td>
                        <td className="right text-green">₹{bankIn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="right text-red">₹{bankOut.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
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
