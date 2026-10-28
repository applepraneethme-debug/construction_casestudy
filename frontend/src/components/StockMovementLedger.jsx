import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const StockMovementLedger = () => {
  const { authFetch, user } = useAuth();
  const [movements, setMovements] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Filter state
  const [filterType, setFilterType] = useState('');
  const [filterSite, setFilterSite] = useState('');

  // Active Action Modal: null | 'receipt' | 'issue' | 'return' | 'transfer' | 'adjustment'
  const [activeModal, setActiveModal] = useState(null);
  const [modalForm, setModalForm] = useState({
    materialId: '',
    quantity: '',
    unitCost: '',
    reference: '',
    reason: '',
    activity: '',
    destinationSite: '',
    newPhysicalQuantity: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const isOwner = user?.role === 'Owner';
  const isManager = user?.role === 'Material Manager';
  const isKeeper = user?.role === 'Storekeeper';

  const canReceive = isOwner || isManager || isKeeper;
  const canIssue = isOwner || isManager || isKeeper;
  const canReturn = isOwner || isManager || isKeeper;
  const canTransfer = isOwner || isManager;
  const canAdjust = isOwner || isManager;

  const fetchLedger = async () => {
    try {
      setLoading(true);
      let query = '/api/movements?';
      if (filterType) query += `movementType=${filterType}&`;
      if (filterSite) query += `site=${filterSite}&`;

      const [movRes, matRes, steRes] = await Promise.all([
        authFetch(query),
        authFetch('/api/inventory'),
        authFetch('/api/sites')
      ]);

      if (movRes.ok) {
        const movData = await movRes.json();
        setMovements(movData);
      }
      if (matRes.ok) {
        const matData = await matRes.json();
        setMaterials(matData);
        if (matData.length > 0 && !modalForm.materialId) {
          setModalForm((prev) => ({ ...prev, materialId: matData[0]._id }));
        }
      }
      if (steRes.ok) {
        const steData = await steRes.json();
        setSites(steData);
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error loading ledger: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [filterType, filterSite]);

  const handleOpenModal = (type) => {
    setActiveModal(type);
    setMessage({ type: '', text: '' });
    setModalForm({
      materialId: materials[0]?._id || '',
      quantity: '',
      unitCost: '',
      reference: '',
      reason: '',
      activity: '',
      destinationSite: sites[0]?.name || '',
      newPhysicalQuantity: '',
      notes: ''
    });
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      let endpoint = `/api/movements/${activeModal}`;
      const payload = { ...modalForm };

      const res = await authFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Operation failed');

      setMessage({ type: 'success', text: `✅ ${data.message}` });
      setActiveModal(null);
      fetchLedger();
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
          <h2>🔄 Stock Movement Ledger</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Append-only historical ledger tracking all material movements across construction sites
          </p>
        </div>

        {/* Action Buttons for Authorized Roles */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {canReceive && (
            <button
              onClick={() => handleOpenModal('receipt')}
              className="btn btn-primary"
              style={{ width: 'auto', background: '#16a34a', border: 'none', padding: '0.45rem 0.8rem', fontSize: '0.85rem' }}
            >
              📥 Receive Stock
            </button>
          )}

          {canIssue && (
            <button
              onClick={() => handleOpenModal('issue')}
              className="btn btn-primary"
              style={{ width: 'auto', background: '#dc2626', border: 'none', padding: '0.45rem 0.8rem', fontSize: '0.85rem' }}
            >
              📤 Issue Material
            </button>
          )}

          {canReturn && (
            <button
              onClick={() => handleOpenModal('return')}
              className="btn btn-secondary"
              style={{ width: 'auto', background: '#0284c7', color: '#fff', border: 'none', padding: '0.45rem 0.8rem', fontSize: '0.85rem' }}
            >
              ↩️ Return Material
            </button>
          )}

          {canTransfer && (
            <button
              onClick={() => handleOpenModal('transfer')}
              className="btn btn-secondary"
              style={{ width: 'auto', background: '#d97706', color: '#fff', border: 'none', padding: '0.45rem 0.8rem', fontSize: '0.85rem' }}
            >
              🔁 Site Transfer
            </button>
          )}

          {canAdjust && (
            <button
              onClick={() => handleOpenModal('adjustment')}
              className="btn btn-secondary"
              style={{ width: 'auto', background: '#7c3aed', color: '#fff', border: 'none', padding: '0.45rem 0.8rem', fontSize: '0.85rem' }}
            >
              ⚖️ Stock Adjustment
            </button>
          )}
        </div>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1.25rem' }}>
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem' }}>
        <div className="filter-group">
          <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Filter By Type:</label>
          <select
            className="form-control"
            style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All Movement Types</option>
            <option value="receipt">Receipt (Supplier)</option>
            <option value="issue">Issue (Site Activity)</option>
            <option value="return">Return (Unused)</option>
            <option value="transfer">Transfer (Inter-site)</option>
            <option value="adjustment">Physical Adjustment</option>
            <option value="wastage">Physical Wastage</option>
          </select>

          <label style={{ fontSize: '0.85rem', fontWeight: 600, marginLeft: '1rem' }}>Site:</label>
          <input
            type="text"
            className="form-control"
            style={{ width: '180px', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
            placeholder="Search site..."
            value={filterSite}
            onChange={(e) => setFilterSite(e.target.value)}
          />

          {(filterType || filterSite) && (
            <button
              onClick={() => { setFilterType(''); setFilterSite(''); }}
              style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.85rem', marginLeft: '0.5rem' }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Movements Table */}
      <div className="card">
        <h3 className="card-title">
          📋 Historical Stock Ledger Transactions
          <span style={{ fontSize: '0.85rem', color: '#64748b', marginLeft: 'auto' }}>
            Records: {movements.length}
          </span>
        </h3>

        {loading ? (
          <div className="empty-state"><p>⏳ Loading stock ledger...</p></div>
        ) : movements.length === 0 ? (
          <div className="empty-state">
            <p>🚫 No transactions matching current filter criteria.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Type</th>
                  <th>Material</th>
                  <th>Quantity</th>
                  <th>Site</th>
                  <th>Reference / Reason</th>
                  <th>Recorded By</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m._id}>
                    <td style={{ fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {new Date(m.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td>
                      <span className={`badge-status badge-${m.movementType}`}>
                        {m.movementType}
                      </span>
                    </td>
                    <td><strong>{m.materialName}</strong></td>
                    <td>
                      <span style={{ fontWeight: 600 }}>
                        {m.movementType === 'issue' || m.movementType === 'wastage' ? '-' : '+'}
                        {m.quantity} {m.unit}
                      </span>
                      {m.totalValue > 0 && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          ${m.totalValue.toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td>
                      {m.movementType === 'transfer' ? (
                        <span>{m.sourceSite} &rarr; <strong>{m.destinationSite}</strong></span>
                      ) : (
                        m.site
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem', color: '#1e293b' }}>{m.reference}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{m.reason}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>{m.recordedByName}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{m.recordedByRole}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Modals */}
      {activeModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 className="card-title">
              {activeModal === 'receipt' && '📥 Receive Stock From Supplier'}
              {activeModal === 'issue' && '📤 Issue Material To Construction Activity'}
              {activeModal === 'return' && '↩️ Return Unused Material To Inventory'}
              {activeModal === 'transfer' && '🔁 Transfer Material Between Sites'}
              {activeModal === 'adjustment' && '⚖️ Physical Count Stock Adjustment'}
            </h3>

            <form onSubmit={handleModalSubmit}>
              <div className="form-group">
                <label>Select Material</label>
                <select
                  className="form-control"
                  value={modalForm.materialId}
                  onChange={(e) => setModalForm({ ...modalForm, materialId: e.target.value })}
                  required
                >
                  {materials.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.itemName} (Available: {m.quantity} {m.unit} @ {m.site})
                    </option>
                  ))}
                </select>
              </div>

              {activeModal !== 'adjustment' && (
                <div className="form-group">
                  <label>Quantity</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="e.g. 25"
                    value={modalForm.quantity}
                    onChange={(e) => setModalForm({ ...modalForm, quantity: e.target.value })}
                    min="0.01"
                    step="any"
                    required
                  />
                </div>
              )}

              {activeModal === 'receipt' && (
                <div className="form-group">
                  <label>Unit Cost ($) [Optional]</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Update unit purchase cost"
                    value={modalForm.unitCost}
                    onChange={(e) => setModalForm({ ...modalForm, unitCost: e.target.value })}
                    min="0"
                    step="any"
                  />
                </div>
              )}

              {activeModal === 'issue' && (
                <div className="form-group">
                  <label>Construction Activity / Zone</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Slab Rebar Fixing, Grid 4-B"
                    value={modalForm.activity}
                    onChange={(e) => setModalForm({ ...modalForm, activity: e.target.value })}
                    required
                  />
                </div>
              )}

              {activeModal === 'transfer' && (
                <div className="form-group">
                  <label>Destination Site</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Site West"
                    value={modalForm.destinationSite}
                    onChange={(e) => setModalForm({ ...modalForm, destinationSite: e.target.value })}
                    required
                  />
                </div>
              )}

              {activeModal === 'adjustment' && (
                <div className="form-group">
                  <label>New Verified Physical Count</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="e.g. 85"
                    value={modalForm.newPhysicalQuantity}
                    onChange={(e) => setModalForm({ ...modalForm, newPhysicalQuantity: e.target.value })}
                    min="0"
                    step="any"
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label>Reference Document / Slip</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. PO-8891, Gate Pass 44"
                  value={modalForm.reference}
                  onChange={(e) => setModalForm({ ...modalForm, reference: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Reason / Audit Note</label>
                <textarea
                  className="form-control"
                  placeholder="Explain transaction rationale..."
                  value={modalForm.reason}
                  onChange={(e) => setModalForm({ ...modalForm, reason: e.target.value })}
                  rows="2"
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting}>
                  {submitting ? 'Recording...' : 'Commit Transaction'}
                </button>
                <button type="button" onClick={() => setActiveModal(null)} className="btn btn-secondary" style={{ width: 'auto', background: '#e2e8f0', color: '#334155' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockMovementLedger;
