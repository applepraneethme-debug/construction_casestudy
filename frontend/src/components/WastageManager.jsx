import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const WastageManager = () => {
  const { authFetch, user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState('consumption'); // 'consumption' | 'physical_wastage'
  const [consumptions, setConsumptions] = useState([]);
  const [wastages, setWastages] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Consumption Form State
  const [consumptionForm, setConsumptionForm] = useState({
    site: '',
    activity: '',
    materialId: '',
    expectedQty: '',
    actualQty: '',
    varianceReason: ''
  });

  // Wastage Form State
  const [wastageForm, setWastageForm] = useState({
    materialId: '',
    quantity: '',
    reason: 'Breakage',
    notes: ''
  });

  const [submitting, setSubmitting] = useState(false);

  const canRecordConsumption = ['Owner', 'Material Manager', 'Site Engineer / Project Manager', 'Site Engineer'].includes(user?.role);
  const canRecordWastage = ['Owner', 'Material Manager', 'Storekeeper'].includes(user?.role);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cRes, wRes, mRes] = await Promise.all([
        authFetch('/api/consumption'),
        authFetch('/api/wastage'),
        authFetch('/api/inventory')
      ]);

      if (cRes.ok) setConsumptions(await cRes.json());
      if (wRes.ok) setWastages(await wRes.json());
      if (mRes.ok) {
        const matData = await mRes.json();
        setMaterials(matData);
        if (matData.length > 0) {
          if (!consumptionForm.materialId) {
            setConsumptionForm((prev) => ({
              ...prev,
              materialId: matData[0]._id,
              site: user?.assignedSites?.length ? user.assignedSites[0] : matData[0].site
            }));
          }
          if (!wastageForm.materialId) {
            setWastageForm((prev) => ({ ...prev, materialId: matData[0]._id }));
          }
        }
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error loading records: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRecordConsumption = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const selectedMat = materials.find((m) => m._id === consumptionForm.materialId);

      const res = await authFetch('/api/consumption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site: consumptionForm.site || selectedMat?.site || 'General Site',
          activity: consumptionForm.activity,
          materialId: consumptionForm.materialId,
          expectedQty: Number(consumptionForm.expectedQty),
          actualQty: Number(consumptionForm.actualQty),
          varianceReason: consumptionForm.varianceReason
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to record consumption');

      setMessage({
        type: 'success',
        text: `✅ Consumption recorded! Excess: ${data.excessQty} (${data.excessPercentage}%)`
      });

      setConsumptionForm({
        site: user?.assignedSites?.length ? user.assignedSites[0] : 'General Site',
        activity: '',
        materialId: materials[0]?._id || '',
        expectedQty: '',
        actualQty: '',
        varianceReason: ''
      });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: '❌ ' + err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordWastage = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await authFetch('/api/wastage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialId: wastageForm.materialId,
          quantity: Number(wastageForm.quantity),
          reason: wastageForm.reason,
          notes: wastageForm.notes
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to record wastage');

      setMessage({ type: 'success', text: `✅ ${data.message}` });
      setWastageForm({
        materialId: materials[0]?._id || '',
        quantity: '',
        reason: 'Breakage',
        notes: ''
      });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: '❌ ' + err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="toolbar-bar">
        <div>
          <h2>📉 Material Consumption & Wastage Control</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Trace planned vs. actual consumption variances and record confirmed physical material write-offs
          </p>
        </div>

        {/* Sub-tab Switcher */}
        <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
          <button
            onClick={() => setActiveSubTab('consumption')}
            className="btn"
            style={{
              width: 'auto',
              padding: '0.45rem 1rem',
              fontSize: '0.85rem',
              background: activeSubTab === 'consumption' ? '#2563eb' : 'transparent',
              color: activeSubTab === 'consumption' ? '#fff' : '#475569',
              borderRadius: '6px'
            }}
          >
            📊 Planned vs Actual Consumption
          </button>
          <button
            onClick={() => setActiveSubTab('physical_wastage')}
            className="btn"
            style={{
              width: 'auto',
              padding: '0.45rem 1rem',
              fontSize: '0.85rem',
              background: activeSubTab === 'physical_wastage' ? '#2563eb' : 'transparent',
              color: activeSubTab === 'physical_wastage' ? '#fff' : '#475569',
              borderRadius: '6px'
            }}
          >
            🗑️ Physical Wastage Register
          </button>
        </div>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1.25rem' }}>
          {message.text}
        </div>
      )}

      {/* SUB-TAB 1: PLANNED VS ACTUAL CONSUMPTION */}
      {activeSubTab === 'consumption' && (
        <div style={{ display: 'grid', gridTemplateColumns: canRecordConsumption ? '1fr 2.2fr' : '1fr', gap: '1.5rem' }}>
          {/* Record Consumption Form */}
          {canRecordConsumption && (
            <div className="card">
              <h3 className="card-title">📝 Track Activity Consumption</h3>
              <form onSubmit={handleRecordConsumption}>
                <div className="form-group">
                  <label>Construction Activity</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Ground Floor Slab Concreting"
                    value={consumptionForm.activity}
                    onChange={(e) => setConsumptionForm({ ...consumptionForm, activity: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Site</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Site Central"
                    value={consumptionForm.site}
                    onChange={(e) => setConsumptionForm({ ...consumptionForm, site: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Material</label>
                  <select
                    className="form-control"
                    value={consumptionForm.materialId}
                    onChange={(e) => setConsumptionForm({ ...consumptionForm, materialId: e.target.value })}
                    required
                  >
                    {materials.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.itemName} ({m.unit} @ {m.site})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label>Expected Quantity</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="e.g. 100"
                      value={consumptionForm.expectedQty}
                      onChange={(e) => setConsumptionForm({ ...consumptionForm, expectedQty: e.target.value })}
                      min="0"
                      step="any"
                      required
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>Actual Consumed</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="e.g. 115"
                      value={consumptionForm.actualQty}
                      onChange={(e) => setConsumptionForm({ ...consumptionForm, actualQty: e.target.value })}
                      min="0"
                      step="any"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Variance Explanation</label>
                  <textarea
                    className="form-control"
                    placeholder="e.g. Over-pouring due to uneven sub-base or rework"
                    value={consumptionForm.varianceReason}
                    onChange={(e) => setConsumptionForm({ ...consumptionForm, varianceReason: e.target.value })}
                    rows="2"
                  />
                </div>

                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Calculating...' : 'Record Consumption'}
                </button>
              </form>
            </div>
          )}

          {/* Consumption History Table */}
          <div className="card">
            <h3 className="card-title">
              📋 Planned vs Actual Consumption Ledger
              <span style={{ fontSize: '0.85rem', color: '#64748b', marginLeft: 'auto' }}>
                Entries: {consumptions.length}
              </span>
            </h3>

            {loading ? (
              <div className="empty-state"><p>⏳ Loading consumption logs...</p></div>
            ) : consumptions.length === 0 ? (
              <div className="empty-state"><p>🚫 No consumption records logged yet.</p></div>
            ) : (
              <div className="table-container">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>Activity / Site</th>
                      <th>Material</th>
                      <th>Expected</th>
                      <th>Actual</th>
                      <th>Excess Variance</th>
                      <th>Explanation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consumptions.map((c) => {
                      const isExcess = c.excessQty > 0;
                      return (
                        <tr key={c._id}>
                          <td>
                            <strong>{c.activity}</strong>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>📍 {c.site}</div>
                          </td>
                          <td><strong>{c.materialName}</strong></td>
                          <td>{c.expectedQty} {c.unit}</td>
                          <td>{c.actualQty} {c.unit}</td>
                          <td>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                background: isExcess ? '#fee2e2' : '#dcfce7',
                                color: isExcess ? '#b91c1c' : '#15803d'
                              }}
                            >
                              {isExcess ? `+${c.excessQty} (+${c.excessPercentage}%)` : 'On Target'}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.82rem', color: '#475569' }}>
                            {c.varianceReason || 'Normal execution'}
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>By {c.reportingUserName}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: PHYSICAL WASTAGE REGISTER */}
      {activeSubTab === 'physical_wastage' && (
        <div style={{ display: 'grid', gridTemplateColumns: canRecordWastage ? '1fr 2.2fr' : '1fr', gap: '1.5rem' }}>
          {/* Record Wastage Form */}
          {canRecordWastage && (
            <div className="card">
              <h3 className="card-title">🗑️ Report Physical Wastage</h3>
              <form onSubmit={handleRecordWastage}>
                <div className="form-group">
                  <label>Material</label>
                  <select
                    className="form-control"
                    value={wastageForm.materialId}
                    onChange={(e) => setWastageForm({ ...wastageForm, materialId: e.target.value })}
                    required
                  >
                    {materials.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.itemName} (Available: {m.quantity} {m.unit} @ {m.site})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Wasted Quantity</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="e.g. 5"
                    value={wastageForm.quantity}
                    onChange={(e) => setWastageForm({ ...wastageForm, quantity: e.target.value })}
                    min="0.01"
                    step="any"
                    required
                  />
                  <small style={{ color: '#dc2626', fontSize: '0.75rem' }}>
                    * Stock will be automatically deducted from inventory ledger.
                  </small>
                </div>

                <div className="form-group">
                  <label>Wastage Reason</label>
                  <select
                    className="form-control"
                    value={wastageForm.reason}
                    onChange={(e) => setWastageForm({ ...wastageForm, reason: e.target.value })}
                    required
                  >
                    <option value="Breakage">Breakage (Handling / transit damage)</option>
                    <option value="Spillage">Spillage (Accidental pour / burst bags)</option>
                    <option value="Cutting Loss">Cutting Loss (Bar off-cuts, panel trimming)</option>
                    <option value="Storage Damage">Storage Damage (Moisture, rust, exposure)</option>
                    <option value="Expiry">Expiry (Shelf life exceeded, e.g. chemical)</option>
                    <option value="Other">Other (Specific damage note required)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Damage Notes / Incident Description</label>
                  <textarea
                    className="form-control"
                    placeholder="Describe how the loss occurred..."
                    value={wastageForm.notes}
                    onChange={(e) => setWastageForm({ ...wastageForm, notes: e.target.value })}
                    rows="2"
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ background: '#be123c' }} disabled={submitting}>
                  {submitting ? 'Writing Off...' : 'Record Physical Wastage'}
                </button>
              </form>
            </div>
          )}

          {/* Wastage Register Table */}
          <div className="card">
            <h3 className="card-title">
              📋 Confirmed Physical Wastage Register
              <span style={{ fontSize: '0.85rem', color: '#64748b', marginLeft: 'auto' }}>
                Total Records: {wastages.length}
              </span>
            </h3>

            {loading ? (
              <div className="empty-state"><p>⏳ Loading wastage register...</p></div>
            ) : wastages.length === 0 ? (
              <div className="empty-state"><p>✅ No physical wastage recorded.</p></div>
            ) : (
              <div className="table-container">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>Material / Site</th>
                      <th>Quantity Wasted</th>
                      <th>Reason</th>
                      <th>Est. Financial Loss</th>
                      <th>Reported By</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wastages.map((w) => (
                      <tr key={w._id}>
                        <td>
                          <strong>{w.materialName}</strong>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>📍 {w.site}</div>
                        </td>
                        <td>
                          <span style={{ color: '#be123c', fontWeight: 700 }}>
                            -{w.quantity} {w.unit}
                          </span>
                        </td>
                        <td>
                          <span className="badge-status badge-wastage">
                            {w.reason}
                          </span>
                        </td>
                        <td>
                          <strong style={{ color: '#b91c1c' }}>
                            ${(w.financialImpact || 0).toLocaleString()}
                          </strong>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            @ ${(w.unitCost || 0)} / {w.unit}
                          </div>
                        </td>
                        <td>
                          <div>{w.reportingUserName}</div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            {new Date(w.date || w.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.82rem', color: '#475569' }}>
                          {w.notes}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WastageManager;
