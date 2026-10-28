import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/format';

const OverviewDashboard = ({ onNavigate }) => {
  const { authFetch, user } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/reports/dashboard');
      if (!res.ok) throw new Error('Failed to load dashboard report');
      const data = await res.json();
      setReport(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return <div className="card empty-state"><p>⏳ Compiling real-time dashboard analytics...</p></div>;
  }

  if (error || !report) {
    return <div className="card alert alert-error">❌ {error || 'Error loading dashboard data'}</div>;
  }

  const { inventory, projects, wastage, consumption, requisitions, recentMovements } = report;

  return (
    <div>
      {/* Overview Module Header */}
      <div className="toolbar-bar" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h2>📊 Executive Project & Material Overview</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Real-time material valuation, site status, stock ledger alerts, and consumption analytics
          </p>
        </div>
        <button
          onClick={fetchDashboard}
          className="btn btn-secondary"
          style={{ width: 'auto', background: '#ffffff', color: '#334155', border: '1px solid #cbd5e1', padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
        >
          🔄 Refresh Metrics
        </button>
      </div>


      {/* KPI Stats Grid */}
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Total Inventory Items</span>
          <span className="stat-value">{inventory.totalItems}</span>
          <span className="stat-hint">Active tracked materials</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Estimated Stock Valuation</span>
          <span className="stat-value" style={{ color: '#059669' }}>
            {formatCurrency(inventory.totalValuation)}
          </span>
          <span className="stat-hint">Sum(Qty &times; Unit Cost)</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Low Stock Alerts</span>
          <span className="stat-value" style={{ color: inventory.lowStockCount > 0 ? '#dc2626' : '#166534' }}>
            {inventory.lowStockCount}
          </span>
          <span className="stat-hint">&le; Minimum threshold</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Total Wastage Cost</span>
          <span className="stat-value" style={{ color: wastage.totalWastageCost > 0 ? '#b91c1c' : '#475569' }}>
            {formatCurrency(wastage.totalWastageCost)}
          </span>
          <span className="stat-hint">{wastage.totalWastageQuantity} units confirmed loss</span>
        </div>


        <div className="stat-card">
          <span className="stat-label">Active Projects / Sites</span>
          <span className="stat-value">{projects.activeProjects} / {projects.activeSites}</span>
          <span className="stat-hint">Managed construction sites</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Pending Requisitions</span>
          <span className="stat-value" style={{ color: requisitions.pendingCount > 0 ? '#d97706' : '#64748b' }}>
            {requisitions.pendingCount}
          </span>
          <span className="stat-hint">Awaiting review & issue</span>
        </div>
      </div>

      {/* Two Column Layout: Critical Alerts and Recent Ledger Movements */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
        
        {/* Left: Low Stock and Excess Consumption Alerts */}
        <div className="card">
          <h3 className="card-title">
            ⚠️ Material & Consumption Alerts
            <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: 'auto' }}>
              Real-Time Tracking
            </span>
          </h3>

          {inventory.lowStockItems.length === 0 && consumption.excessCount === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 1rem' }}>
              <p>✅ All materials are above minimum thresholds and consumption is on track.</p>
            </div>
          ) : (
            <div>
              {inventory.lowStockItems.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#b91c1c', marginBottom: '0.5rem' }}>
                    🚨 Low Stock Items Requiring Replenishment:
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {inventory.lowStockItems.slice(0, 5).map((item) => (
                      <li
                        key={item.id}
                        style={{
                          padding: '0.5rem 0.75rem',
                          background: '#fef2f2',
                          borderRadius: '6px',
                          border: '1px solid #fee2e2',
                          marginBottom: '0.35rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.85rem'
                        }}
                      >
                        <span>
                          <strong>{item.itemName}</strong> • {item.site}
                        </span>
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>
                          {item.quantity} / {item.minThreshold} {item.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {consumption.topVariances.length > 0 && (
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#d97706', marginBottom: '0.5rem' }}>
                    📈 Significant Consumption Variances:
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {consumption.topVariances.slice(0, 4).map((c) => (
                      <li
                        key={c._id}
                        style={{
                          padding: '0.5rem 0.75rem',
                          background: '#fffbeb',
                          borderRadius: '6px',
                          border: '1px solid #fef3c7',
                          marginBottom: '0.35rem',
                          fontSize: '0.82rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong>{c.materialName} ({c.site})</strong>
                          <span style={{ color: '#b45309', fontWeight: 600 }}>
                            +{c.excessQty} {c.unit} (+{c.excessPercentage}%)
                          </span>
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '2px' }}>
                          Activity: {c.activity} {c.varianceReason ? `• ${c.varianceReason}` : ''}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Recent Stock Movement Ledger Events */}
        <div className="card">
          <h3 className="card-title">
            🔄 Recent Stock Movements Ledger
            <button
              onClick={() => onNavigate('movements')}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              View All &rarr;
            </button>
          </h3>

          {recentMovements.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 1rem' }}>
              <p>No transactions posted to stock ledger yet.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Material</th>
                    <th>Qty</th>
                    <th>Site</th>
                    <th>User</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMovements.map((m) => (
                    <tr key={m._id}>
                      <td>
                        <span className={`badge-status badge-${m.movementType}`}>
                          {m.movementType}
                        </span>
                      </td>
                      <td><strong>{m.materialName}</strong></td>
                      <td>{m.quantity} {m.unit}</td>
                      <td>{m.site}</td>
                      <td>
                        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          {m.recordedByName}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default OverviewDashboard;
