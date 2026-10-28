import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const RequisitionManager = () => {
  const { authFetch, user } = useAuth();
  const [requisitions, setRequisitions] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Create Requisition Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    site: '',
    activity: '',
    priority: 'Medium',
    materialId: '',
    quantityRequested: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const isOwner = user?.role === 'Owner';
  const isManager = user?.role === 'Material Manager';
  const isEngineer = user?.role === 'Site Engineer / Project Manager' || user?.role === 'Site Engineer';
  const isKeeper = user?.role === 'Storekeeper';

  const canCreate = isOwner || isManager || isEngineer;
  const canApprove = isOwner || isManager;
  const canFulfill = isOwner || isManager || isKeeper;

  const fetchData = async () => {
    try {
      setLoading(true);
      const [reqRes, matRes, steRes] = await Promise.all([
        authFetch('/api/requisitions'),
        authFetch('/api/inventory'),
        authFetch('/api/sites')
      ]);

      if (reqRes.ok) {
        const reqData = await reqRes.json();
        setRequisitions(reqData);
      }
      let loadedSites = [];
      if (steRes.ok) {
        loadedSites = await steRes.json();
        setSites(loadedSites);
      }
      if (matRes.ok) {
        const matData = await matRes.json();
        setMaterials(matData);
        if (matData.length > 0 && !formData.materialId) {
          const userSite = user?.assignedSites?.find((as) => loadedSites.some((s) => s.name === as));
          const initialSite = userSite || loadedSites[0]?.name || matData[0]?.site || '';
          const siteMaterials = matData.filter((m) => !m.site || m.site === initialSite);
          setFormData((prev) => ({
            ...prev,
            site: initialSite,
            materialId: siteMaterials[0]?._id || matData[0]._id
          }));
        }
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error loading requisitions: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateRequisition = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      if (!formData.site || !formData.site.trim()) {
        throw new Error('Please select an authorized construction site.');
      }

      const selectedMat = materials.find((m) => m._id === formData.materialId);
      if (!selectedMat) {
        throw new Error('Please select a material.');
      }

      if (selectedMat.site && selectedMat.site !== formData.site.trim()) {
        throw new Error(`Selected material '${selectedMat.itemName}' is at '${selectedMat.site}', not '${formData.site}'.`);
      }

      const res = await authFetch('/api/requisitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site: formData.site.trim(),
          activity: formData.activity,
          priority: formData.priority,
          items: [
            {
              material: formData.materialId,
              quantityRequested: Number(formData.quantityRequested)
            }
          ],
          notes: formData.notes
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create requisition');

      setMessage({ type: 'success', text: `✅ ${data.message}` });
      setShowCreateModal(false);
      const userSite = user?.assignedSites?.find((as) => sites.some((s) => s.name === as));
      const nextSite = userSite || sites[0]?.name || '';
      const nextMats = materials.filter((m) => !m.site || m.site === nextSite);
      setFormData({
        site: nextSite,
        activity: '',
        priority: 'Medium',
        materialId: nextMats[0]?._id || materials[0]?._id || '',
        quantityRequested: '',
        notes: ''
      });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: '❌ ' + err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (reqId) => {
    if (!window.confirm('Approve this material requisition for warehouse issuance?')) return;
    try {
      const res = await authFetch(`/api/requisitions/${reqId}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Approval failed');
      setMessage({ type: 'success', text: `✅ ${data.message}` });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: '❌ ' + err.message });
    }
  };

  const handleReject = async (reqId) => {
    const reason = window.prompt('Enter reason for rejecting requisition:');
    if (!reason || !reason.trim()) return;

    try {
      const res = await authFetch(`/api/requisitions/${reqId}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Rejection failed');
      setMessage({ type: 'success', text: `✅ ${data.message}` });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: '❌ ' + err.message });
    }
  };

  const handleFulfill = async (reqId) => {
    if (!window.confirm('Fulfill this approved requisition? Materials will be automatically deducted from stock.')) return;
    try {
      const res = await authFetch(`/api/requisitions/${reqId}/fulfill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Fulfillment failed');
      setMessage({ type: 'success', text: `✅ ${data.message}` });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: '❌ ' + err.message });
    }
  };

  return (
    <div>
      <div className="toolbar-bar">
        <div>
          <h2>📋 Material Requisitions & Approvals</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Site requisition requests, management authorization, and atomic stock issuance
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
            style={{ width: 'auto', padding: '0.5rem 1rem' }}
          >
            ➕ Create Requisition
          </button>
        )}
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1.25rem' }}>
          {message.text}
        </div>
      )}

      {/* Requisitions List */}
      <div className="card">
        <h3 className="card-title">
          📋 Requisition Queue
          <span style={{ fontSize: '0.85rem', color: '#64748b', marginLeft: 'auto' }}>
            Total: {requisitions.length}
          </span>
        </h3>

        {loading ? (
          <div className="empty-state"><p>⏳ Loading requisitions...</p></div>
        ) : requisitions.length === 0 ? (
          <div className="empty-state">
            <p>🚫 No material requisitions in queue.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Req #</th>
                  <th>Activity / Site</th>
                  <th>Requested Materials</th>
                  <th>Priority</th>
                  <th>Requested By</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requisitions.map((req) => {
                  const isRequester = req.requestedBy === user._id;
                  return (
                    <tr key={req._id}>
                      <td>
                        <strong>{req.requisitionNumber}</strong>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {new Date(req.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td>
                        <strong>{req.activity}</strong>
                        <div style={{ fontSize: '0.78rem', color: '#475569' }}>📍 {req.site}</div>
                      </td>
                      <td>
                        {req.items.map((it, idx) => (
                          <div key={idx} style={{ fontSize: '0.85rem' }}>
                            <strong>{it.materialName}</strong>: {it.quantityRequested} {it.unit}
                            {req.status === 'Fulfilled' && (
                              <span style={{ color: '#16a34a', marginLeft: '4px', fontSize: '0.75rem' }}>
                                (Issued)
                              </span>
                            )}
                          </div>
                        ))}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: req.priority === 'Urgent' ? '#dc2626' : req.priority === 'High' ? '#ea580c' : '#475569'
                          }}
                        >
                          {req.priority}
                        </span>
                      </td>
                      <td>
                        <div>{req.requestedByName}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{req.requestedByRole}</div>
                      </td>
                      <td>
                        <span className={`badge-status badge-${req.status.toLowerCase()}`}>
                          {req.status}
                        </span>
                        {req.approvedByName && (
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                            By {req.approvedByName}
                          </div>
                        )}
                        {req.rejectionReason && (
                          <div style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '2px' }}>
                            {req.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {/* Approval Actions */}
                          {req.status === 'Pending' && canApprove && (
                            <>
                              <button
                                onClick={() => handleApprove(req._id)}
                                className="btn btn-primary"
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.75rem',
                                  background: '#16a34a',
                                  width: 'auto'
                                }}
                                disabled={isRequester && !isOwner}
                                title={isRequester && !isOwner ? 'Separation of duties: Cannot approve your own request' : 'Approve Requisition'}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(req._id)}
                                className="btn btn-danger"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {/* Fulfillment Action */}
                          {req.status === 'Approved' && canFulfill && (
                            <button
                              onClick={() => handleFulfill(req._id)}
                              className="btn btn-primary"
                              style={{
                                padding: '0.25rem 0.6rem',
                                fontSize: '0.75rem',
                                background: '#4338ca',
                                width: 'auto'
                              }}
                            >
                              📦 Fulfill & Issue
                            </button>
                          )}

                          {req.status === 'Fulfilled' && (
                            <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
                              ✓ Completed
                            </span>
                          )}

                          {req.status === 'Rejected' && (
                            <span style={{ fontSize: '0.75rem', color: '#dc2626', fontStyle: 'italic' }}>
                              Closed
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create Requisition */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 className="card-title">📝 Create Material Requisition</h3>
            <form onSubmit={handleCreateRequisition}>
              <div className="form-group">
                <label>Construction Activity / Zone</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Column Casting, Ground Floor"
                  value={formData.activity}
                  onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label>Construction Site</label>
                  <select
                    className="form-control"
                    value={formData.site}
                    onChange={(e) => {
                      const newSite = e.target.value;
                      const siteMats = materials.filter((m) => !m.site || m.site === newSite);
                      setFormData((prev) => ({
                        ...prev,
                        site: newSite,
                        materialId: siteMats[0]?._id || ''
                      }));
                    }}
                    required
                  >
                    <option value="">-- Select Construction Site --</option>
                    {sites.map((s) => (
                      <option key={s._id} value={s.name}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label>Priority</label>
                  <select
                    className="form-control"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 2 }}>
                  <label>Material (Filtered by Site)</label>
                  <select
                    className="form-control"
                    value={formData.materialId}
                    onChange={(e) => setFormData({ ...formData, materialId: e.target.value })}
                    required
                  >
                    <option value="">-- Select Material --</option>
                    {materials
                      .filter((m) => !formData.site || !m.site || m.site === formData.site)
                      .map((m) => (
                        <option key={m._id} value={m._id}>
                          {m.itemName} (Stock: {m.quantity} {m.unit} @ {m.site || 'General Site'})
                        </option>
                      ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label>Quantity Required</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="e.g. 50"
                    value={formData.quantityRequested}
                    onChange={(e) => setFormData({ ...formData, quantityRequested: e.target.value })}
                    min="0.01"
                    step="any"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Justification Notes</label>
                <textarea
                  className="form-control"
                  placeholder="Why are these materials needed for this activity?"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows="2"
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Requisition'}
                </button>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary" style={{ width: 'auto', background: '#e2e8f0', color: '#334155' }}>
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

export default RequisitionManager;
