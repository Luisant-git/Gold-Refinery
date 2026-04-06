// src/pages/VoucherList.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { exchangeAPI, salesAPI, purchaseAPI } from '../db/api';
import { fmtDate } from '../db/utils';
import PrintReceipt from '../components/PrintReceipt';

export default function VoucherList() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('exchange');
  const [vouchers, setVouchers] = useState([]);
  const [filters, setFilters] = useState({
    date_from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
    mobile: '',
  });
  const [detail, setDetail] = useState(null);
  const [printDetail, setPrintDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const roundTo10 = (val) => Math.floor((parseFloat(val) || 0) / 10) * 10;

  useEffect(() => { load(); }, [activeTab]);

  const load = async (f = filters) => {
    setLoading(true); setMsg(null);
    try {
      let data = [];
      if (activeTab === 'exchange') data = await exchangeAPI.getAll(f);
      else if (activeTab === 'sales') data = await salesAPI.getAll(f);
      else data = await purchaseAPI.getAll(f);
      setVouchers(data);
    } catch (e) { setMsg({ type: 'danger', text: e.message }); }
    setLoading(false);
  };

  const viewDetail = async (v) => {
    try {
      let full = null;
      if (activeTab === 'exchange') full = await exchangeAPI.getById(v.id);
      else if (activeTab === 'sales') full = await salesAPI.getById(v.id);
      else full = await purchaseAPI.getById(v.id);
      setDetail(full);
    } catch (e) { setMsg({ type: 'danger', text: e.message }); }
  };

const floorTo3Decimal = (num) => {
  const n = parseFloat(num) || 0;
  return Math.floor(n * 1000) / 1000;
};
  // For list: use actual_pure_wt if available (exchange), else total_pure_wt
const getPureWt = v => activeTab === 'exchange'
  ? floorTo3Decimal(parseFloat(v.actual_pure_gold || v.actual_pure_wt || v.total_pure_wt || 0))
  : parseFloat(v.total_pure_wt || 0);
  const totalGross = vouchers.reduce((s, v) => s + (parseFloat(v.total_gross_wt) || 0), 0);
  const totalPure = vouchers.reduce((s, v) => s + getPureWt(v), 0);
  const totalAmount = vouchers.reduce((s, v) => s + (parseFloat(v.net_amount) || 0), 0);

  const monoStyle = { fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">VOUCHER REGISTER</div>
        <div className="btn-group">
          {[['exchange', 'Exchange'], ['sales', 'Sales'], ['purchase', 'Purchase']].map(([tab, label]) => (
            <button key={tab}
              className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab(tab)}>{label}</button>
          ))}
        </div>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Filters */}
      <div className="card">
        <div className="filter-bar" style={{ marginBottom: 0 }}>
          <div className="form-group">
            <label>From Date</label>
            <input type="date" value={filters.date_from}
              onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>To Date</label>
            <input type="date" value={filters.date_to}
              onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Mobile</label>
            <input type="text" placeholder="Filter by mobile..."
              value={filters.mobile}
              onChange={e => setFilters(f => ({ ...f, mobile: e.target.value }))} />
          </div>
          <div className="form-group" style={{ paddingTop: 20 }}>
            <button className="btn btn-primary" onClick={() => load(filters)}>Apply</button>
          </div>
          <div className="form-group" style={{ paddingTop: 20 }}>
            <button className="btn btn-secondary" onClick={() => navigate(`/${activeTab}`)}>+ New</button>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      {vouchers.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          {[
            { label: 'Vouchers', value: vouchers.length, unit: '' },
            { label: 'Total Gross Wt', value: totalGross.toFixed(3), unit: 'g' },
           { label: 'Total Pure Wt', value: totalPure.toFixed(3), unit: 'g' },
            ...(activeTab !== 'exchange' ? [{ label: 'Total Amount', value: `₹${roundTo10(totalAmount).toLocaleString('en-IN')}`, unit: '' }] : []),
          ].map((s, i) => (
            <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: '9px 14px', flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>{s.label}</div>
              <div style={{ ...monoStyle, fontSize: 18, color: 'var(--gold-dark)' }}>{s.value}{s.unit}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="card">
        {loading ? <p className="text-muted" style={{ padding: 12 }}>Loading...</p>
          : vouchers.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">☰</div><p>No vouchers found</p></div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Voucher No</th><th>Date</th><th>Mobile</th><th>Customer</th>
                    <th className="right">Gross Wt (g)</th>
                    <th className="right">Pure Wt (g)</th>
                    {activeTab !== 'exchange' && <th className="right">Net Amount (₹)</th>}
                    {activeTab === 'exchange' && <th className="right">Balance (g)</th>}
                    <th>Status</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map(v => {
                    const pureWt = getPureWt(v);
const balance = activeTab === 'exchange'
  ? floorTo3Decimal(
      (
        (parseFloat(v.pure_wt_given || v.pure_gold_given || 0) * 99.92) / 100
      ) - parseFloat(v.total_pure_wt || 0)
    )
  : 0;
                    return (
                      <tr key={v.id}>
                        <td className="font-mono text-gold" style={{ fontSize: 12 }}>{v.voucher_no}</td>
                        <td style={{ fontSize: 12 }}>{fmtDate(v.voucher_date)}</td>
                        <td className="font-mono" style={{ fontSize: 12 }}>{v.mobile}</td>
                        <td>{v.customer_name}</td>
                        <td className="right td-number">{parseFloat(v.total_gross_wt || 0).toFixed(3)}</td>
                        <td className="right td-number">
{activeTab === 'exchange' ? pureWt.toFixed(3) : pureWt.toFixed(3)}
</td>
                        {activeTab !== 'exchange' && (
                          <td className="right td-number">₹{roundTo10(v.net_amount).toLocaleString('en-IN')}</td>
                        )}
                        {activeTab === 'exchange' && (
                          <td className="right td-number" style={{
                            color: balance > 0.001 ? 'var(--red)' : balance < -0.001 ? 'var(--blue)' : 'var(--green)',
                            fontWeight: 700,
                          }}>
                           {balance.toFixed(3)}
                          </td>
                        )}
                        <td><span className="badge badge-success">{v.status || 'completed'}</span></td>
                        <td style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-secondary btn-xs"
                            onClick={() => viewDetail(v)}
                          >
                            View
                          </button>

                          <button
                            className="btn btn-primary btn-xs"
                            onClick={() => navigate(`/${activeTab}?edit=${v.id}`)}
                          >
                            Edit
                          </button>

                          <button
                            className="btn btn-secondary btn-xs"
                            onClick={async () => {
                              let full = null;
                              try {
                                if (activeTab === 'exchange') full = await exchangeAPI.getById(v.id);
                                else if (activeTab === 'sales') full = await salesAPI.getById(v.id);
                                else full = await purchaseAPI.getById(v.id);
                                setPrintDetail(full);
                              } catch (e) { }
                            }}
                          >
                            🖨
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>{vouchers.length} vouchers</td>
                    <td className="right">{totalGross.toFixed(3)}</td>
               <td className="right">{totalPure.toFixed(3)}</td>
                    {activeTab !== 'exchange' && <td className="right">₹{roundTo10(totalAmount).toLocaleString('en-IN')}</td>}
                    {activeTab === 'exchange' && <td></td>}
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
      </div>

      {/* Detail Modal */}
      {detail && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div className="modal" style={{ maxWidth: 920 }}>
            <div className="modal-header">
              <div className="modal-title">{detail.voucher_no}</div>
              <div className="btn-group">
                <button className="btn btn-secondary btn-sm" onClick={() => setPrintDetail(detail)}>🖨 Print</button>
                <button className="modal-close" onClick={() => setDetail(null)}>✕</button>
              </div>
            </div>
            <div className="modal-body">

              {/* Customer + Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>CUSTOMER</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{detail.customer_name}</div>
                  <div style={{ ...monoStyle, fontSize: 13, color: 'var(--text-muted)' }}>{detail.mobile}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>DATE</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{fmtDate(detail.voucher_date)}</div>
                  {detail.rate_per_gram && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                      Rate: ₹{parseFloat(detail.rate_per_gram).toLocaleString('en-IN')}/g
                    </div>
                  )}
                </div>
              </div>

              {/* Items table — exchange uses new columns */}
              {detail.items && detail.items.length > 0 && (
                <div className="table-container" style={{ marginBottom: 16 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>S.No</th>
                        {activeTab === 'exchange' ? (
                          <>
                            <th>Token No</th>
                            <th className="right">Katcha Wt (g)</th>
                            <th className="right">Katcha Touch</th>
                            <th className="right">Less Touch</th>
                            <th className="right">Balance Touch</th>
                            <th className="right">Pure Wt (g)</th>
                          </>
                        ) : (
                          <>
                            <th>Item</th>
                            <th className="right">Katcha Wt</th>
                            <th className="right">Token Wt</th>
                            <th className="right">Total Wt</th>
                            <th className="right">Touch</th>
                            <th className="right">Pure Wt</th>
                            <th className="right">Amount</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items.map(item => (
                        <tr key={item.id}>
                          <td>{item.sno}</td>
                          {activeTab === 'exchange' ? (
                            <>
                              <td style={{ ...monoStyle, fontSize: 13 }}>{item.token_no || '—'}</td>
                              <td className="right td-number">{parseFloat(item.katcha_wt || 0).toFixed(3)}</td>
                              <td className="right td-number">{parseFloat(item.katcha_touch || 0).toFixed(2)}</td>
                              <td className="right td-number">{parseFloat(item.less_touch || 0).toFixed(2)}</td>
                              <td className="right td-number" style={{ color: 'var(--gold-dark)', fontWeight: 700 }}>
                                {parseFloat(item.balance_touch || 0).toFixed(2)}
                              </td>
                              <td className="right td-number" style={{ color: 'var(--green)', fontWeight: 700 }}>
                                {parseFloat(item.pure_wt || 0).toFixed(3)}
                              </td>
                            </>
                          ) : (
                            <>
                              <td>{item.item_description || '—'}</td>
                              <td className="right td-number">{parseFloat(item.katcha_wt || 0).toFixed(3)}</td>
                              <td className="right td-number">{parseFloat(item.token_wt || 0).toFixed(3)}</td>
                              <td className="right td-number">{parseFloat(item.gross_wt || 0).toFixed(3)}</td>
                              <td className="right">{item.touch}%</td>
                              <td className="right td-number">{parseFloat(item.pure_wt || 0).toFixed(3)}</td>
                              <td className="right td-number">₹{parseFloat(item.amount || 0).toFixed(2)}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Summary bottom */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="calc-box">
                  <div className="calc-row">
                    <span className="calc-label">Total Gross Wt</span>
                    <span className="calc-value">{parseFloat(detail.total_gross_wt || 0).toFixed(3)} g</span>
                  </div>
                  {activeTab === 'exchange' && (
                    <>
                      <div className="calc-row">
                        <span className="calc-label">Total Pure Wt (raw)</span>
                        <span className="calc-value text-green">
                          {parseFloat(detail.actual_pure_wt || detail.total_pure_wt || 0).toFixed(3)} g
                        </span>
                      </div>
                     
                      {detail.pure_touch && (
                        <div className="calc-row">
                          <span className="calc-label">Pure Touch Applied</span>
                          <span className="calc-value">{parseFloat(detail.pure_touch || 99.90).toFixed(2)}%</span>
                        </div>
                      )}
                    </>
                  )}
                  {activeTab !== 'exchange' && (
                    <div className="calc-row">
                      <span className="calc-label">Total Pure Wt</span>
                      <span className="calc-value text-green">{parseFloat(detail.total_pure_wt || 0).toFixed(3)} g</span>
                    </div>
                  )}
                </div>
              
                <div className="calc-box">
                  {activeTab === 'exchange' ? (
                    <>
                      <div className="calc-row">
                        <span className="calc-label">Net Pure Owed</span>
                        <span className="calc-value">
                          {parseFloat(detail.total_pure_wt || 0).toFixed(3)} g
                        </span>
                      </div>

                      <div className="calc-row">
                        <span className="calc-label">Pure Gold Given</span>
                        <span className="calc-value" style={{ color: 'var(--gold-dark)', fontWeight: 700 }}>
                          {parseFloat(detail.pure_wt_given || detail.pure_gold_given || 0).toFixed(3)} g
                        </span>
                      </div>

                      <div className="calc-row">
                        <span className="calc-label">Required Cash</span>
                        <span className="calc-value">
                          ₹{parseFloat(detail.required_cash || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="calc-row">
                        <span className="calc-label">Cash Paid</span>
                        <span className="calc-value">
                          ₹{parseFloat(detail.cash_given || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                     

                      {parseFloat(detail.extra_cash || 0) > 0 && (
                        <div className="calc-row">
                          <span className="calc-label" style={{ color: 'var(--red)', fontWeight: 700 }}>
                            Extra Cash Given
                          </span>
                          <span className="calc-value" style={{ color: 'var(--red)', fontWeight: 700 }}>
                            ₹{parseFloat(detail.extra_cash || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}

<div className="calc-row total">
  <span className="calc-label">Balance</span>
  <span className="calc-value big" style={{
    color: (
      (((parseFloat(detail.pure_wt_given || detail.pure_gold_given || 0) * 99.92) / 100) - parseFloat(detail.total_pure_wt || 0))
    ) > 0.001
      ? 'var(--blue)'
      : (
        (((parseFloat(detail.pure_wt_given || detail.pure_gold_given || 0) * 99.92) / 100) - parseFloat(detail.total_pure_wt || 0))
      ) < -0.001
        ? 'var(--red)'
        : 'var(--green)'
  }}>
    {(
      (((parseFloat(detail.pure_wt_given || detail.pure_gold_given || 0) * 99.92) / 100) - parseFloat(detail.total_pure_wt || 0))
    ).toFixed(3)} g
  </span>
</div>
                      {detail.transaction_type && (
                        <div className="calc-row">
                          <span className="calc-label">Settlement Type</span>
                          <span className={`badge ${detail.transaction_type === 'sales'
                            ? 'badge-info'
                            : detail.transaction_type === 'purchase'
                              ? 'badge-warning'
                              : 'badge-success'
                            }`}>
                            {detail.transaction_type === 'sales'
                              ? 'SALES OB (Extra gold given)'
                              : detail.transaction_type === 'purchase'
                                ? 'PURCHASE (Less gold given)'
                                : parseFloat(detail.extra_cash || 0) > 0
                                  ? 'NIL (Settled with extra cash)'
                                  : 'NIL (Fully settled)'}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="calc-row">
                        <span className="calc-label">Net Amount</span>
                        <span className="calc-value big">₹{roundTo10(detail.net_amount).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="calc-row">
                        <span className="calc-label">Payment Mode</span>
                        <span className="calc-value">{detail.payment_mode}</span>
                      </div>
                    </>
                  )}
                  {detail.remarks && (
                    <div className="calc-row">
                      <span className="calc-label">Remarks</span>
                      <span className="calc-value" style={{ fontSize: 12 }}>{detail.remarks}</span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Print Receipt modal */}
      {printDetail && (
        <PrintReceipt
          voucher={printDetail}
          type={activeTab}
          onClose={() => setPrintDetail(null)}
        />
      )}
    </div>
  );
}
