import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const LoginView = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" style={{ maxWidth: '440px', margin: '4rem auto', padding: '1rem' }}>
      <div className="card" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <span className="badge-lab" style={{ marginBottom: '0.5rem', display: 'inline-block' }}>
            Enterprise Access
          </span>
          <h2 style={{ fontSize: '1.5rem', margin: '0.5rem 0' }}>🔐 Construction System Login</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Sign in with your role-authorized credentials
          </p>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            ❌ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="login-email">Email Address</label>
            <input
              type="email"
              id="login-email"
              className="form-control"
              placeholder="e.g. owner@construction.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input
              type="password"
              id="login-password"
              className="form-control"
              placeholder="Enter your secure password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div
          style={{
            marginTop: '1.5rem',
            padding: '0.85rem',
            background: '#f8fafc',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            fontSize: '0.78rem',
            color: '#475569'
          }}
        >
          <strong>Owner Setup Reminder:</strong>
          <p style={{ margin: '0.25rem 0 0 0' }}>
            Initial Owner account is securely created via the CLI bootstrap script:
            <code style={{ display: 'block', margin: '0.25rem 0', background: '#fff', padding: '0.25rem 0.5rem', border: '1px solid #cbd5e1' }}>
              npm run bootstrap:owner
            </code>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
