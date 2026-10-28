import React from 'react';
import { useAuth } from '../context/AuthContext';

const Navbar = ({ activeTab, onSelectTab }) => {
  const { user, logout } = useAuth();

  if (!user) return null;

  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case 'Owner':
        return { background: '#7c3aed', color: '#fff' };
      case 'Material Manager':
        return { background: '#2563eb', color: '#fff' };
      case 'Site Engineer / Project Manager':
      case 'Site Engineer':
        return { background: '#059669', color: '#fff' };
      case 'Storekeeper':
        return { background: '#d97706', color: '#fff' };
      default:
        return { background: '#64748b', color: '#fff' };
    }
  };

  const isOwner = user.role === 'Owner';
  const isManager = user.role === 'Material Manager';
  const isEngineer = user.role === 'Site Engineer / Project Manager' || user.role === 'Site Engineer';
  const isKeeper = user.role === 'Storekeeper';

  const canSeeProjects = isOwner || isManager || isEngineer;
  const canSeeMovements = isOwner || isManager || isKeeper;

  return (
    <header className="header" style={{ marginBottom: '1.5rem', padding: '1.25rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="badge-lab" style={{ margin: 0 }}>Enterprise Construction ERP</span>
            <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>● Atlas Connected</span>
          </div>
          <h1 style={{ margin: '0.25rem 0', fontSize: '1.75rem' }}>
            🏗️ Construction Inventory & Wastage System
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
            Multi-Site Material Tracking, Transactional Stock Ledger & Wastage Control
          </p>
        </div>

        {/* User Profile Pill & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', background: '#f8fafc', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{user.name}</div>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.2rem' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontWeight: 600,
                  ...getRoleBadgeStyle(user.role)
                }}
              >
                {user.role}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {isOwner ? '🌐 All Sites' : (user.assignedSites?.length ? user.assignedSites.join(', ') : 'No Site')}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="btn btn-danger"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Role-Aware Navigation Tabs */}
      <nav style={{ display: 'flex', gap: '0.4rem', marginTop: '1.25rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        <button
          onClick={() => onSelectTab('overview')}
          className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            background: activeTab === 'overview' ? '#2563eb' : '#f1f5f9',
            color: activeTab === 'overview' ? '#fff' : '#334155',
            width: 'auto',
            padding: '0.45rem 0.9rem',
            fontSize: '0.85rem'
          }}
        >
          📊 Overview
        </button>

        <button
          onClick={() => onSelectTab('inventory')}
          className={`btn ${activeTab === 'inventory' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            background: activeTab === 'inventory' ? '#2563eb' : '#f1f5f9',
            color: activeTab === 'inventory' ? '#fff' : '#334155',
            width: 'auto',
            padding: '0.45rem 0.9rem',
            fontSize: '0.85rem'
          }}
        >
          📦 Inventory
        </button>

        {canSeeProjects && (
          <button
            onClick={() => onSelectTab('projects')}
            className={`btn ${activeTab === 'projects' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              background: activeTab === 'projects' ? '#2563eb' : '#f1f5f9',
              color: activeTab === 'projects' ? '#fff' : '#334155',
              width: 'auto',
              padding: '0.45rem 0.9rem',
              fontSize: '0.85rem'
            }}
          >
            🏗️ Projects & Sites
          </button>
        )}

        {canSeeMovements && (
          <button
            onClick={() => onSelectTab('movements')}
            className={`btn ${activeTab === 'movements' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              background: activeTab === 'movements' ? '#2563eb' : '#f1f5f9',
              color: activeTab === 'movements' ? '#fff' : '#334155',
              width: 'auto',
              padding: '0.45rem 0.9rem',
              fontSize: '0.85rem'
            }}
          >
            🔄 Stock Ledger
          </button>
        )}

        <button
          onClick={() => onSelectTab('requisitions')}
          className={`btn ${activeTab === 'requisitions' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            background: activeTab === 'requisitions' ? '#2563eb' : '#f1f5f9',
            color: activeTab === 'requisitions' ? '#fff' : '#334155',
            width: 'auto',
            padding: '0.45rem 0.9rem',
            fontSize: '0.85rem'
          }}
        >
          📋 Requisitions
        </button>

        <button
          onClick={() => onSelectTab('wastage')}
          className={`btn ${activeTab === 'wastage' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            background: activeTab === 'wastage' ? '#2563eb' : '#f1f5f9',
            color: activeTab === 'wastage' ? '#fff' : '#334155',
            width: 'auto',
            padding: '0.45rem 0.9rem',
            fontSize: '0.85rem'
          }}
        >
          📉 Consumption & Wastage
        </button>

        {isOwner && (
          <button
            onClick={() => onSelectTab('users')}
            className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              background: activeTab === 'users' ? '#7c3aed' : '#f1f5f9',
              color: activeTab === 'users' ? '#fff' : '#334155',
              width: 'auto',
              padding: '0.45rem 0.9rem',
              fontSize: '0.85rem'
            }}
          >
            👥 User Management
          </button>
        )}
      </nav>
    </header>
  );
};

export default Navbar;
