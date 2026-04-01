// client/src/db/api.js
const BASE = 'http://localhost:3001/api';

async function req(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  let res;
  try { res = await fetch(`${BASE}${path}`, opts); }
  catch(e) { throw new Error('Cannot reach server. Make sure Express is running on port 3001.'); }
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json'))
    throw new Error(`Server returned HTML for ${path}. Check Express is running.`);
  return res.json();
}

const get  = p     => req('GET',    p);
const post = (p,b) => req('POST',   p, b);
const put  = (p,b) => req('PUT',    p, b);
const del  = p     => req('DELETE', p);

export const dbStatus     = () => fetch(`${BASE}/db/status`).then(r=>r.ok?r.json():{connected:false}).catch(()=>({connected:false}));
export const testConn     = cfg  => post('/db/test', cfg);
export const runSetup     = ()   => post('/db/setup', {});
export const fixObSkipped = ()   => post('/exchange/fix-ob-skipped', {});

export const authAPI = {
  login:    data => post('/auth/login', data),
  register: data => post('/auth/register', data),
};

export const customerAPI = {
  getAll:      ()       => get('/customers').then(r=>r.rows||[]),
  search:      q        => get(`/customers/search?q=${encodeURIComponent(q)}`).then(r=>r.rows||[]),
  getByMobile: mobile   => get(`/customers/by-mobile/${encodeURIComponent(mobile)}`).then(r=>r.row||null),
  create:      data     => post('/customers', data),
  update:      (id,data)=> put(`/customers/${id}`, data),
  delete:      id       => del(`/customers/${id}`),
};

export const rateAPI = {
  getAll:    ()   => get('/rates').then(r=>r.rows||[]),
  getLatest: ()   => get('/rates/latest').then(r=>r.row||null),
  create:    data => post('/rates', data),
};

export const touchAPI = {
  getAll:  ()        => get('/touch').then(r=>r.rows||[]),
  create:  data      => post('/touch', data),
  update:  (id,data) => put(`/touch/${id}`, data),
  delete:  id        => del(`/touch/${id}`),
};

export const exchangeAPI = {
  getAll:         (f={}) => get(`/exchange?${new URLSearchParams(f)}`).then(r=>r.rows||[]),
  getById:        id     => get(`/exchange/${id}`).then(r=>r.row),
  getNextNo:      ()     => get('/exchange/next-no').then(r=>r.voucher_no||'—'),
  getCustomerOB:  custId => get(`/exchange/customer-ob/${custId}`),
  create:         (voucherData,items) => post('/exchange', {voucherData,items}),
};

export const salesAPI = {
  getAll:        (f={}) => get(`/sales?${new URLSearchParams(f)}`).then(r=>r.rows||[]),
  getById:       id     => get(`/sales/${id}`).then(r=>r.row),
  getCustomerOB: custId => get(`/sales/customer-ob/${custId}`),
  create:        (voucherData,items) => post('/sales', {voucherData,items}),
};

export const purchaseAPI = {
  getAll:        (f={}) => get(`/purchase?${new URLSearchParams(f)}`).then(r=>r.rows||[]),
  getById:       id     => get(`/purchase/${id}`).then(r=>r.row),
  getCustomerOB: custId => get(`/purchase/customer-ob/${custId}`),
  create:        (voucherData,items) => post('/purchase', {voucherData,items}),
};

export const processingAPI = {
  getAll:         ()              => get('/processing').then(r=>r.rows||[]),
  getUnprocessed: ()              => get('/processing/unprocessed').then(r=>r.rows||[]),
  create:         (data,srcItems) => post('/processing', {data,sourceItems:srcItems}),
};

export const stockAPI = {
  getLedger:  (f={}) => get(`/stock/ledger?${new URLSearchParams(f)}`).then(r=>r.rows||[]),
  getCash:    (f={}) => get(`/stock/cash?${new URLSearchParams(f)}`).then(r=>r.rows||[]),
  getCurrent: ()     => get('/stock/current'),
};

export const cashEntryAPI = {
  getAll: (f={}) => get(`/cash-entries?${new URLSearchParams(f)}`).then(r=>r.rows||[]),
  create: data   => post('/cash-entries', data),
};

export const goldEntryAPI = {
  getAll: (f={}) => get(`/gold-entries?${new URLSearchParams(f)}`).then(r=>r.rows||[]),
  create: data   => post('/gold-entries', data),
};

export const expenseAPI = {
  getAll:  (f={}) => get(`/expenses?${new URLSearchParams(f)}`).then(r=>r.rows||[]),
  create:  data   => post('/expenses', data),
  delete:  id     => del(`/expenses/${id}`),
};

export const reportAPI = {
  getDashboard: () => get('/reports/dashboard').then(r=>r.row||{}),
};

export const pureTokenAPI = {
  getAll:  ()        => get('/pure-tokens').then(r => r.rows || []),
  create:  data      => post('/pure-tokens', data),
  update:  (id,data) => put(`/pure-tokens/${id}`, data),
  delete:  id        => del(`/pure-tokens/${id}`),
};