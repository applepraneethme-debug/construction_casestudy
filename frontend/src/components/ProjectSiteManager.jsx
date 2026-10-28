import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const ProjectSiteManager = () => {
  const { authFetch, user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Form states
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectForm, setProjectForm] = useState({
    name: '',
    code: '',
    description: '',
    location: '',
    budget: ''
  });

  const [showSiteModal, setShowSiteModal] = useState(false);
  const [siteForm, setSiteForm] = useState({
    name: '',
    code: '',
    project: '',
    address: ''
  });

  const isOwner = user?.role === 'Owner';

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prjRes, steRes] = await Promise.all([
        authFetch('/api/projects'),
        authFetch('/api/sites')
      ]);

      if (prjRes.ok && steRes.ok) {
        const prjData = await prjRes.json();
        const steData = await steRes.json();
        setProjects(prjData);
        setSites(steData);
        if (prjData.length > 0 && !siteForm.project) {
          setSiteForm((prev) => ({ ...prev, project: prjData[0]._id }));
        }
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error fetching projects and sites: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...projectForm,
          budget: Number(projectForm.budget) || 0
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create project');

      setMessage({ type: 'success', text: `✅ Project '${data.project.name}' created successfully!` });
      setShowProjectModal(false);
      setProjectForm({ name: '', code: '', description: '', location: '', budget: '' });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: '❌ ' + err.message });
    }
  };

  const handleCreateSite = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteForm)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create site');

      setMessage({ type: 'success', text: `✅ Site '${data.site.name}' created and linked to project!` });
      setShowSiteModal(false);
      setSiteForm({ name: '', code: '', project: projects[0]?._id || '', address: '' });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: '❌ ' + err.message });
    }
  };

  return (
    <div>
      <div className="toolbar-bar">
        <div>
          <h2>🏗️ Construction Projects & Job Sites</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Multi-site project hierarchies for material allocation and site-scoping
          </p>
        </div>

        {isOwner && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setShowProjectModal(true)}
              className="btn btn-primary"
              style={{ width: 'auto', padding: '0.5rem 1rem' }}
            >
              ➕ New Project
            </button>
            <button
              onClick={() => setShowSiteModal(true)}
              className="btn btn-secondary"
              style={{ width: 'auto', background: '#059669', color: '#fff', border: 'none', padding: '0.5rem 1rem' }}
              disabled={projects.length === 0}
            >
              📍 Add Construction Site
            </button>
          </div>
        )}
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1.25rem' }}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="card empty-state"><p>⏳ Loading construction projects and sites...</p></div>
      ) : projects.length === 0 ? (
        <div className="card empty-state">
          <p>🚫 No projects registered yet.</p>
          {isOwner && <p style={{ fontSize: '0.85rem' }}>Click 'New Project' above to create your company's first construction project.</p>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
          {projects.map((proj) => {
            const projectSites = sites.filter((s) => s.project?._id === proj._id || s.project === proj._id);
            return (
              <div key={proj._id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: '4px' }}>
                      {proj.code}
                    </span>
                    <h3 style={{ fontSize: '1.2rem', marginTop: '0.35rem', color: '#0f172a' }}>{proj.name}</h3>
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontWeight: 600,
                      background: proj.status === 'Active' ? '#dcfce7' : '#f1f5f9',
                      color: proj.status === 'Active' ? '#166534' : '#475569'
                    }}
                  >
                    {proj.status}
                  </span>
                </div>

                <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.75rem' }}>
                  {proj.description || 'No description provided.'}
                </p>

                <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}>
                  <div>📍 Location: <strong>{proj.location || 'Not specified'}</strong></div>
                  <div>💰 Budget: <strong>${(proj.budget || 0).toLocaleString()}</strong></div>
                </div>

                <div style={{ marginTop: 'auto', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: '#1e293b' }}>
                    Construction Sites ({projectSites.length}):
                  </div>
                  {projectSites.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
                      No sites attached yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {projectSites.map((site) => (
                        <span
                          key={site._id}
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 500,
                            color: '#334155'
                          }}
                        >
                          🏗️ {site.name} ({site.code})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: New Project */}
      {showProjectModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 className="card-title">➕ Create Construction Project</h3>
            <form onSubmit={handleCreateProject}>
              <div className="form-group">
                <label>Project Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Skyline Commercial Tower"
                  value={projectForm.name}
                  onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Project Code (Unique)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. SCT-01"
                  value={projectForm.code}
                  onChange={(e) => setProjectForm({ ...projectForm, code: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Sector 62, Gurgaon"
                  value={projectForm.location}
                  onChange={(e) => setProjectForm({ ...projectForm, location: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Budget Allocation ($)</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="e.g. 2500000"
                  value={projectForm.budget}
                  onChange={(e) => setProjectForm({ ...projectForm, budget: e.target.value })}
                  min="0"
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="form-control"
                  placeholder="Scope of construction work..."
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  rows="3"
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Project</button>
                <button type="button" onClick={() => setShowProjectModal(false)} className="btn btn-secondary" style={{ width: 'auto', background: '#e2e8f0', color: '#334155' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Site */}
      {showSiteModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 className="card-title">📍 Add Construction Site</h3>
            <form onSubmit={handleCreateSite}>
              <div className="form-group">
                <label>Parent Project</label>
                <select
                  className="form-control"
                  value={siteForm.project}
                  onChange={(e) => setSiteForm({ ...siteForm, project: e.target.value })}
                  required
                >
                  {projects.map((p) => (
                    <option key={p._id} value={p._id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Site Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Tower A - Foundation Zone"
                  value={siteForm.name}
                  onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Site Code (Unique)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. STE-TA"
                  value={siteForm.code}
                  onChange={(e) => setSiteForm({ ...siteForm, code: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Site Address / Gate</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. North Gate Logistics Bay"
                  value={siteForm.address}
                  onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Site</button>
                <button type="button" onClick={() => setShowSiteModal(false)} className="btn btn-secondary" style={{ width: 'auto', background: '#e2e8f0', color: '#334155' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectSiteManager;
