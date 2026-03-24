// client/src/pages/Login.jsx
import React, { useState } from 'react';
import { authAPI } from '../db/api';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password');
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.login({ username: username.trim(), password });
      if (res.success) {
        localStorage.setItem('gr_user', JSON.stringify(res.user));
        onLogin(res.user);
      } else {
        setError(res.error || 'Login failed');
      }
    } catch (err) {
      setError('Cannot reach server. Is the backend running?');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      {/* Background decoration */}
      <div className="login-bg-pattern" />

      <div className="login-container">
        {/* Left branding panel */}
        <div className="login-brand">
          <div className="login-brand-inner">
            <div className="login-brand-icon">⬡</div>
            <h1 className="login-brand-title">GOLD<br/>REFINERY</h1>
            <p className="login-brand-sub">Management System</p>
            <div className="login-brand-divider" />
            <p className="login-brand-desc">
              Complete solution for managing exchange, sales, purchase,
              and stock operations with real-time tracking.
            </p>
          </div>
          <div className="login-brand-footer">
            <span className="login-brand-version">v1.0.0</span>
          </div>
        </div>

        {/* Right login form */}
        <div className="login-form-panel">
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-form-header">
              <h2 className="login-form-title">Welcome Back</h2>
              <p className="login-form-subtitle">Sign in to your account</p>
            </div>

            {error && (
              <div className="login-error">
                <span className="login-error-icon">⚠</span>
                {error}
              </div>
            )}

            <div className="login-field">
              <label htmlFor="login-username">Username</label>
              <div className="login-input-wrap">
                <span className="login-input-icon">◉</span>
                <input
                  id="login-username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="login-password">Password</label>
              <div className="login-input-wrap">
                <span className="login-input-icon">🔒</span>
                <input
                  id="login-password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              className="login-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="login-spinner" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>

            <p className="login-footer-text">
              Gold Refinery Management System © 2026
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
