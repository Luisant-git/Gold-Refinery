// client/src/App.jsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Dashboard        from './pages/Dashboard';
import ExchangeVoucher  from './pages/ExchangeVoucher';
import SalesVoucher     from './pages/SalesVoucher';
import PurchaseVoucher  from './pages/PurchaseVoucher';
import ProcessingReport from './pages/ProcessingReport';
import StockReport      from './pages/StockReport';
import CashEntry        from './pages/CashEntry';
import GoldEntry        from './pages/GoldEntry';
import Expenses         from './pages/Expenses';
import CustomerMaster   from './pages/CustomerMaster';
import VoucherList      from './pages/VoucherList';
import Settings         from './pages/Settings';
import Login            from './pages/Login';
import { dbStatus }     from './db/api';
import PureTokenMaster from './pages/PureTokenMaster';

const NAV = [
  { to:'/',            label:'Dashboard',   icon:'◈' },
  { to:'/exchange',    label:'Exchange',     icon:'⇄' },
  { to:'/sales',       label:'Sales',        icon:'↑' },
  { to:'/purchase',    label:'Purchase',     icon:'↓' },
  { to:'/processing',  label:'Processing',   icon:'⚙' },
  { to:'/stock',       label:'Stock',        icon:'▦' },
  { to:'/cash-entry',  label:'Cash Entry',   icon:'₹' },
  { to:'/gold-entry',  label:'Gold Entry',   icon:'⬡' },
  { to:'/expenses',    label:'Expenses',     icon:'📋' },
  { to:'/vouchers',    label:'Voucher List', icon:'☰' },
  { to:'/customers',   label:'Customers',    icon:'◉' },
  { to:'/pure-token-master', label:'Pure Token Master', icon:'#' },
];

function Sidebar({ dbConnected, collapsed, setCollapsed, mobileOpen, setMobileOpen, isMobile, user, onLogout }) {
  return (
    <>
      {mobileOpen && isMobile && <div className="sidebar-backdrop" onClick={()=>setMobileOpen(false)} />}
      <aside className={'sidebar'+(isMobile&&!mobileOpen?' mobile-hidden':'')}>
        <div className="sidebar-header">
          {!collapsed&&<><span className="sidebar-logo">⬡</span><span className="sidebar-title">GOLD<br/>REFINERY</span></>}
          {collapsed&&!isMobile&&<span className="sidebar-logo">⬡</span>}
          <button className="sidebar-toggle" onClick={()=>isMobile?setMobileOpen(false):setCollapsed(c=>!c)}>
            {isMobile?'✕':collapsed?'›':'‹'}
          </button>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(l=>(
            <NavLink key={l.to} to={l.to} end={l.to==='/'}
              className={({isActive})=>'nav-item'+(isActive?' active':'')}
              onClick={()=>isMobile&&setMobileOpen(false)}>
              <span className="nav-icon">{l.icon}</span>
              {!collapsed&&<span className="nav-label">{l.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span className={'db-dot '+(dbConnected?'db-dot-on':'db-dot-off')} />
            {!collapsed&&<span className="db-status-text">{dbConnected?'DB Connected':'DB Offline'}</span>}
          </div>
          {!collapsed && user && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'rgba(201,150,15,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.displayName || user.username}
              </span>
              <button
                onClick={onLogout}
                style={{
                  background: 'none', border: '1px solid rgba(201,150,15,0.2)',
                  color: 'rgba(201,150,15,0.4)', fontSize: 11, padding: '3px 8px',
                  borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600,
                }}
                title="Logout"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function Layout({ dbConnected, user, onLogout }) {
  const [collapsed,   setCollapsed]  = useState(false);
  const [mobileOpen,  setMobileOpen] = useState(false);
  const [isMobile,    setIsMobile]   = useState(window.innerWidth<=768);
  const location = useLocation();

  useEffect(()=>{ const fn=()=>setIsMobile(window.innerWidth<=768); window.addEventListener('resize',fn); return()=>window.removeEventListener('resize',fn); },[]);
  useEffect(()=>{ setMobileOpen(false); },[location.pathname]);

  const layoutClass='app-layout'+(!isMobile&&collapsed?' sidebar-collapsed':'');
  const currentLabel=NAV.find(n=>n.to==='/'?location.pathname==='/':location.pathname.startsWith(n.to))?.label||'Gold Refinery';

  return (
    <div className={layoutClass}>
      <Sidebar dbConnected={dbConnected} collapsed={!isMobile&&collapsed}
        setCollapsed={setCollapsed} mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen} isMobile={isMobile}
        user={user} onLogout={onLogout} />
      <div className="main-content">
        {isMobile&&(
          <div className="mobile-topbar">
            <button className="mobile-menu-btn" onClick={()=>setMobileOpen(o=>!o)}>☰</button>
            <span className="mobile-title">{currentLabel.toUpperCase()}</span>
            <span className={'db-dot '+(dbConnected?'db-dot-on':'db-dot-off')} style={{marginLeft:'auto'}} />
          </div>
        )}
        <Routes>
          <Route path="/"            element={<Dashboard />} />
          <Route path="/exchange"    element={<ExchangeVoucher />} />
          <Route path="/sales"       element={<SalesVoucher />} />
          <Route path="/purchase"    element={<PurchaseVoucher />} />
          <Route path="/processing"  element={<ProcessingReport />} />
          <Route path="/stock"       element={<StockReport />} />
          <Route path="/cash-entry"  element={<CashEntry />} />
          <Route path="/gold-entry"  element={<GoldEntry />} />
          <Route path="/expenses"    element={<Expenses />} />
          <Route path="/vouchers"    element={<VoucherList />} />
          <Route path="/customers"   element={<CustomerMaster />} />
          <Route path="/settings"    element={<Settings />} />
          <Route path="/pure-token-master" element={<PureTokenMaster />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  const [dbConnected, setDbConnected] = useState(false);
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('gr_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  useEffect(()=>{
    const check=()=>dbStatus().then(r=>setDbConnected(r.connected)).catch(()=>setDbConnected(false));
    check(); const t=setInterval(check,5000); return()=>clearInterval(t);
  },[]);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('gr_user');
    setUser(null);
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <Layout dbConnected={dbConnected} user={user} onLogout={handleLogout} />
    </BrowserRouter>
  );
}
