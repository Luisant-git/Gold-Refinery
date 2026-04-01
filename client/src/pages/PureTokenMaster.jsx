import React, { useEffect, useState } from 'react';
import { pureTokenAPI } from '../db/api';

export default function PureTokenMaster() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ token_no: '', pure_touch: '' });
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await pureTokenAPI.getAll();
      setRows(data);
    } catch (e) {
      setMsg({ type: 'danger', text: e.message });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const clearForm = () => {
    setForm({ token_no: '', pure_touch: '' });
    setEditingId(null);
    setMsg(null);
  };

  const handleSave = async () => {
    if (!form.token_no.trim()) {
      setMsg({ type: 'danger', text: 'Token number is required' });
      return;
    }
    if (form.pure_touch === '') {
      setMsg({ type: 'danger', text: 'Pure touch is required' });
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      if (editingId) {
        await pureTokenAPI.update(editingId, form);
        setMsg({ type: 'success', text: 'Token updated successfully' });
      } else {
        await pureTokenAPI.create(form);
        setMsg({ type: 'success', text: 'Token added successfully' });
      }

      clearForm();
      load();
    } catch (e) {
      setMsg({ type: 'danger', text: e.message });
    }

    setSaving(false);
  };

  const handleEdit = row => {
    setEditingId(row.id);
    setForm({
      token_no: row.token_no || '',
      pure_touch: row.pure_touch || '',
    });
    setMsg(null);
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this token?')) return;

    try {
      await pureTokenAPI.delete(id);
      setMsg({ type: 'success', text: 'Token deleted successfully' });
      load();
    } catch (e) {
      setMsg({ type: 'danger', text: e.message });
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">PURE TOKEN MASTER</div>
        <div className="btn-group">
          <button className="btn btn-secondary" onClick={clearForm}>Clear</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : editingId ? 'Update Token' : 'Add Token'}
          </button>
        </div>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type}`}>{msg.text}</div>
      )}

      <div className="card">
        <div className="form-grid form-grid-2">
          <div className="form-group">
            <label>Token Number *</label>
            <input
              type="text"
              value={form.token_no}
              onChange={e => setForm(f => ({ ...f, token_no: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label>Pure Touch *</label>
            <input
              type="number"
              step="0.01"
              value={form.pure_touch}
              onChange={e => setForm(f => ({ ...f, pure_touch: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Token List</div>

        <div className="table-container">
          <table className="item-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th>Token Number</th>
                <th className="right">Pure Touch</th>
                <th style={{ width: 140 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                    No tokens added yet
                  </td>
                </tr>
              ) : rows.map((row, idx) => (
                <tr key={row.id}>
                  <td>{idx + 1}</td>
                  <td>{row.token_no}</td>
                  <td className="right">{parseFloat(row.pure_touch).toFixed(2)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(row)}>
                        Edit
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(row.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}