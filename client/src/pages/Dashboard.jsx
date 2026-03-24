// client/src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportAPI, rateAPI } from '../db/api';

export default function Dashboard() {
  const navigate  = useNavigate();
  const [data,    setData]    = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportAPI.getDashboard()
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const monoStyle = { fontFamily:'JetBrains Mono, monospace', fontWeight:600 };
  const fmt = (n, d=3) => parseFloat(n||0).toFixed(d);
  const fmtCash = n => parseFloat(n||0).toLocaleString('en-IN', { minimumFractionDigits:0, maximumFractionDigits:0 });

  if (loading) return (
    <div className="page">
      <div style={{padding:40,textAlign:'center',color:'var(--text-muted)'}}>Loading dashboard...</div>
    </div>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">DASHBOARD</div>
        <span style={{fontSize:12,color:'var(--text-muted)'}}>
          {new Date().toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
        </span>
      </div>

      {/* Today's activity */}
      <div className="card-title" style={{marginBottom:10,paddingBottom:0,borderBottom:'none',fontSize:11,letterSpacing:2,color:'var(--text-muted)'}}>TODAY'S ACTIVITY</div>
      <div className="stats-grid" style={{marginBottom:20}}>
        <div className="stat-card" onClick={()=>navigate('/exchange')} style={{cursor:'pointer'}}>
          <div className="stat-icon">⇄</div>
          <div className="stat-value" style={monoStyle}>{data.exchange_today_count||0}</div>
          <div className="stat-label">Exchange Vouchers</div>
          <div className="stat-sub">{fmt(data.exchange_today_wt)}g pure gold</div>
        </div>
        <div className="stat-card" onClick={()=>navigate('/sales')} style={{cursor:'pointer'}}>
          <div className="stat-icon" style={{color:'var(--blue)'}}>↑</div>
          <div className="stat-value" style={monoStyle}>{data.sales_today_count||0}</div>
          <div className="stat-label">Sales Vouchers</div>
          <div className="stat-sub">₹{fmtCash(data.sales_today_amount)}</div>
        </div>
        <div className="stat-card" onClick={()=>navigate('/purchase')} style={{cursor:'pointer'}}>
          <div className="stat-icon" style={{color:'var(--green)'}}>↓</div>
          <div className="stat-value" style={monoStyle}>{data.purchase_today_count||0}</div>
          <div className="stat-label">Purchase Vouchers</div>
          <div className="stat-sub">₹{fmtCash(data.purchase_today_amount)}</div>
        </div>
        <div className="stat-card" onClick={()=>navigate('/stock')} style={{cursor:'pointer',borderColor:'rgba(26,110,64,0.3)'}}>
          <div className="stat-icon" style={{color:'var(--green)'}}>⬡</div>
          <div className="stat-value" style={{...monoStyle,color:'var(--green)'}}>{fmt(data.current_stock)}g</div>
          <div className="stat-label">Gold Stock</div>
          {data.latest_rate_24k>0&&<div className="stat-sub">≈ ₹{fmtCash(parseFloat(data.current_stock||0)*parseFloat(data.latest_rate_24k||0))}</div>}
        </div>
      </div>

      {/* Quick access */}
      <div className="card-title" style={{marginBottom:10,paddingBottom:0,borderBottom:'none',fontSize:11,letterSpacing:2,color:'var(--text-muted)'}}>QUICK ACCESS</div>
      <div className="stats-grid" style={{marginBottom:20}}>
        <div className="stat-card" onClick={()=>navigate('/cash-entry')} style={{cursor:'pointer',borderColor:'rgba(26,80,128,0.2)'}}>
          <div className="stat-icon" style={{color:'var(--blue)'}}>₹</div>
          <div className="stat-value" style={{...monoStyle,color:'var(--blue)',fontSize:20}}>₹{fmtCash(data.cash_out_total)}</div>
          <div className="stat-label">Total Cash Given</div>
          <div className="stat-sub">Cash entry loans</div>
        </div>
        <div className="stat-card" onClick={()=>navigate('/gold-entry')} style={{cursor:'pointer',borderColor:'rgba(184,134,11,0.3)'}}>
          <div className="stat-icon">⬡</div>
          <div className="stat-value" style={{...monoStyle,fontSize:20}}>{fmt(data.gold_out_total)}g</div>
          <div className="stat-label">Total Gold Given</div>
          <div className="stat-sub">Gold entry loans</div>
        </div>
        <div className="stat-card" onClick={()=>navigate('/customers')} style={{cursor:'pointer'}}>
          <div className="stat-icon">◉</div>
          <div className="stat-value" style={monoStyle}>{data.total_customers||0}</div>
          <div className="stat-label">Total Customers</div>
        </div>
        <div className="stat-card" onClick={()=>navigate('/rates')} style={{cursor:'pointer'}}>
          <div className="stat-icon">₹</div>
          <div className="stat-value" style={monoStyle}>₹{fmtCash(data.latest_rate_24k)}</div>
          <div className="stat-label">24K Rate / gram</div>
          <div className="stat-sub">Latest gold rate</div>
        </div>
      </div>

      {/* Quick nav buttons */}
      <div className="card">
        <div className="card-title">Quick Actions</div>
        <div className="btn-group" style={{flexWrap:'wrap',gap:10}}>
          {[
            {label:'New Exchange',  path:'/exchange',   cls:'btn-primary'},
            {label:'New Sales',     path:'/sales',      cls:'btn-secondary'},
            {label:'New Purchase',  path:'/purchase',   cls:'btn-secondary'},
            {label:'Cash Entry',    path:'/cash-entry', cls:'btn-secondary'},
            {label:'Gold Entry',    path:'/gold-entry', cls:'btn-secondary'},
            {label:'Expenses',      path:'/expenses',   cls:'btn-secondary'},
            {label:'Stock Report',  path:'/stock',      cls:'btn-secondary'},
          ].map(a=>(
            <button key={a.path} className={`btn ${a.cls}`} onClick={()=>navigate(a.path)}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
