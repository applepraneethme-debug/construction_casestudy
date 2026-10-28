import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const UserManagement = () => {
  const { authFetch, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // New user form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Material Manager',
    assignedSites: []
  });
  const [submitting, setSubmitting] = useState(false);

  // Edit user modal state
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    role: 'Material Manager',
    assignedSites: []
  });

  // Fetch all users and sites
  const fetchUsersAndSites = async () => {
    try {
      setLoading(true);
      const [uRes, sRes] = await Promise.all([
        authFetch('/api/users'),
        authFetch('/api/sites')
      ]);

      if (!uRes.ok) {
        const data = await uRes.json();
        throw new Error(data.message || 'Failed to fetch users');
      }
      setUsers(await uRes.json());
      if (sRes.ok) {
        setSites(await sRes.json());
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndSites();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await authFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          assignedSites: formData.assignedSites
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create user');
      }

      setMessage({ type: 'success', text: `✅ User ${data.user.name} (${data.user.role}) created successfully!` });
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'Material Manager',
        assignedSites: []
      });
      fetchUsersAndSites();
    } catch (err) {
      setMessage({ type: 'error', text: '❌ ' + err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (user) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      role: user.role,
      assignedSites: user.assignedSites || []
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch(`/api/users/${editingUser._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          role: editForm.role,
          assignedSites: editForm.assignedSites
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update user');

      setMessage({ type: 'success', text: `✅ User '${data.user.name}' updated successfully!` });
      setEditingUser(null);
      fetchUsersAndSites();
    } catch (err) {
      setMessage({ type: 'error', text: '❌ ' + err.message });
    }
  };

  const handleToggleStatus = async (user) => {
    const action = user.isActive ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${action} ${user.name}?`)) return;

    try {
      const res = await authFetch(`/api/users/${user._id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Failed to ${action} user`);
      }

      setMessage({ type: 'success', text: `✅ User status updated successfully.` });
      fetchUsers();
    } catch (err) {
      setMessage({ type: 'error', text: '❌ ' + err.message });
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <h2>👥 User & RBAC Management</h2>
        <p style={{ color: '#64748b' }}>
          Configure enterprise roles, site-level scoping, and user active status.
        </p>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1.25rem' }}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
        {/* Left: Add User Form */}
        <div className="card">
          <h3 className="card-title">➕ Create System User</h3>
          <form onSubmit={handleCreateUser}>
            <div className="form-group">
              <label htmlFor="user-name">Full Name</label>
              <input
                type="text"
                id="user-name"
                name="name"
                className="form-control"
                placeholder="e.g. John Doe"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="user-email">Email Address</label>
              <input
                type="email"
                id="user-email"
                name="email"
                className="form-control"
                placeholder="e.g. jdoe@company.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="user-password">Initial Password</label>
              <input
                type="password"
                id="user-password"
                name="password"
                className="form-control"
                placeholder="Min 6 characters"
                value={formData.password}
                onChange={handleChange}
                minLength="6"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="user-role">Role Assignment</label>
              <select
                id="user-role"
                name="role"
                className="form-control"
                value={formData.role}
                onChange={handleChange}
                required
              >
                <option value="Material Manager">Material Manager</option>
                <option value="Site Engineer / Project Manager">Site Engineer / Project Manager</option>
                <option value="Storekeeper">Storekeeper</option>
                <option value="Owner">Owner</option>
              </select>
            </div>

            <div className="form-group">
              <label>Assigned Construction Sites</label>
              {formData.role === 'Owner' ? (
                <div style={{ fontSize: '0.82rem', color: '#059669', background: '#ecfdf5', padding: '0.5rem', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                  🌐 Owners have full global access to all current and future sites.
                </div>
              ) : sites.length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic' }}>
                  No construction sites registered yet. Create sites in Projects & Sites first.
                </div>
              ) : (
                <div style={{ maxHeight: '130px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', background: '#fff' }}>
                  {sites.map((s) => (
                    <label key={s._id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.assignedSites.includes(s.name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, assignedSites: [...formData.assignedSites, s.name] });
                          } else {
                            setFormData({ ...formData, assignedSites: formData.assignedSites.filter((name) => name !== s.name) });
                          }
                        }}
                      />
                      <span>{s.name} ({s.code})</span>
                    </label>
                  ))}
                </div>
              )}
              <small style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginTop: '3px' }}>
                Select all construction sites this employee is authorized to access.
              </small>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
              {submitting ? 'Creating User...' : 'Create User'}
            </button>
          </form>
        </div>

        {/* Right: Existing Users Table */}
        <div className="card">
          <h3 className="card-title">
            📋 System Users
            <span style={{ fontSize: '0.85rem', color: '#64748b', marginLeft: 'auto' }}>
              Total: {users.length}
            </span>
          </h3>

          {loading ? (
            <div className="empty-state"><p>⏳ Loading users...</p></div>
          ) : users.length === 0 ? (
            <div className="empty-state"><p>No users found.</p></div>
          ) : (
            <div className="table-container">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Name / Email</th>
                    <th>Role</th>
                    <th>Assigned Sites</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = u._id === currentUser._id;
                    return (
                      <tr key={u._id}>
                        <td>
                          <strong>{u.name}</strong>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{u.email}</div>
                        </td>
                        <td>
                          <span className="badge-category" style={{ background: '#e0e7ff', color: '#3730a3' }}>
                            {u.role}
                          </span>
                        </td>
                        <td>
                          {u.role === 'Owner' ? (
                            <span style={{ color: '#059669', fontWeight: 500 }}>All Sites (Global)</span>
                          ) : u.assignedSites?.length ? (
                            u.assignedSites.join(', ')
                          ) : (
                            <span style={{ color: '#94a3b8' }}>None</span>
                          )}
                        </td>
                        <td>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: u.isActive ? '#dcfce7' : '#fee2e2',
                              color: u.isActive ? '#166534' : '#991b1b'
                            }}
                          >
                            {u.isActive ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#e2e8f0', color: '#1e293b' }}
                              onClick={() => handleStartEdit(u)}
                            >
                              Edit / Assign
                            </button>
                            {!isSelf && (
                              <button
                                className={`btn ${u.isActive ? 'btn-danger' : 'btn-primary'}`}
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                onClick={() => handleToggleStatus(u)}
                              >
                                {u.isActive ? 'Deactivate' : 'Activate'}
                              </button>
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
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 className="card-title">✏️ Edit User & Assign Sites</h3>
            <form onSubmit={handleSaveEdit}>
              <div className="form-group">
                <label>User Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Role</label>
                <select
                  className="form-control"
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  disabled={editingUser._id === currentUser._id}
                >
                  <option value="Owner">Owner</option>
                  <option value="Material Manager">Material Manager</option>
                  <option value="Site Engineer / Project Manager">Site Engineer / Project Manager</option>
                  <option value="Storekeeper">Storekeeper</option>
                </select>
                {editingUser._id === currentUser._id && (
                  <small style={{ color: '#64748b', fontSize: '0.75rem' }}>
                    You cannot change your own Owner role.
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Assigned Construction Sites</label>
                {editForm.role === 'Owner' ? (
                  <div style={{ fontSize: '0.82rem', color: '#059669', background: '#ecfdf5', padding: '0.5rem', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                    🌐 Owners have full global access to all current and future sites.
                  </div>
                ) : sites.length === 0 ? (
                  <div style={{ fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic' }}>
                    No construction sites registered yet.
                  </div>
                ) : (
                  <div style={{ maxHeight: '130px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', background: '#fff' }}>
                    {sites.map((s) => (
                      <label key={s._id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={editForm.assignedSites.includes(s.name)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditForm({ ...editForm, assignedSites: [...editForm.assignedSites, s.name] });
                            } else {
                              setEditForm({ ...editForm, assignedSites: editForm.assignedSites.filter((name) => name !== s.name) });
                            }
                          }}
                        />
                        <span>{s.name} ({s.code})</span>
                      </label>
                    ))}
                  </div>
                )}
                <small style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginTop: '3px' }}>
                  Restricts non-owners to view, receive, and issue materials only at these sites.
                </small>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Changes</button>
                <button type="button" onClick={() => setEditingUser(null)} className="btn btn-secondary" style={{ width: 'auto', background: '#e2e8f0', color: '#334155' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
