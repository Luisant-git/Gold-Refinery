// client/src/db/utils.js
// Safe date formatters — SQL Server returns Date objects, not strings

export function fmtDate(val) {
  if (!val) return '';
  try {
    const d = val instanceof Date ? val : new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric' });
  } catch { return String(val); }
}

export function fmtDateTime(val) {
  if (!val) return '';
  try {
    const d = val instanceof Date ? val : new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  } catch { return String(val); }
}

export function fmtDateInput(val) {
  if (!val) return '';
  try {
    const d = val instanceof Date ? val : new Date(val);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch { return ''; }
}
