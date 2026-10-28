import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Compact Top Header Component
 * Contains:
 * - Mobile hamburger drawer toggle
 * - Application title
 * - Dynamic backend connection status from /api/health
 * - Current site scope indicator
 * - Logged-in user's name and role badge
 * - Sign-out action
 */
const CompactHeader = ({ onOpenMobileSidebar, activeTab }) => {
  const { user, logout } = useAuth();
  const [backendHealth, setBackendHealth] = useState({
    status: 'checking',
    database: 'connecting',
    dbName: null
  });

  const checkHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setBackendHealth({
          status: data.status,
          database: data.database,
          dbName: data.dbName
        });
      } else {
        setBackendHealth({ status: 'unhealthy', database: 'disconnected', dbName: null });
      }
    } catch {
      setBackendHealth({ status: 'error', database: 'unreachable', dbName: null });
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (!user) return null;

  const isOwner = user.role === 'Owner';

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

  const isDbConnected = backendHealth.database === 'connected';

  return (
    <header className="compact-header">
      <div className="header-left">
        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          className="mobile-hamburger-btn mobile-only"
          onClick={onOpenMobileSidebar}
          aria-label="Open navigation menu"
        >
          ☰
        </button>

        <div className="header-titles">
          <h1 className="header-app-title">
            🏗️ Construction Inventory & Wastage
          </h1>
          <span className="header-page-tag">
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
          </span>
        </div>
      </div>

      <div className="header-right">
        {/* Dynamic Database Connection Indicator */}
        <div
          className={`health-pill ${isDbConnected ? 'connected' : 'disconnected'}`}
          title={isDbConnected ? `Connected to Atlas: ${backendHealth.dbName || 'constructionDB'}` : 'Database Disconnected'}
        >
          <span className="health-dot" />
          <span className="health-label">
            {isDbConnected ? 'Atlas Connected' : 'DB Disconnected'}
          </span>
        </div>

        {/* Site Scope Indicator */}
        <div className="site-scope-pill" title="Current Site Scope">
          <span className="scope-icon">{isOwner ? '🌐' : '📍'}</span>
          <span className="scope-text">
            {isOwner
              ? 'All Sites'
              : user.assignedSites?.length
              ? user.assignedSites.join(', ')
              : 'No Site'}
          </span>
        </div>

        {/* User Pill & Sign Out */}
        <div className="user-profile-wrapper">
          <div className="user-meta">
            <span className="user-name">{user.name}</span>
            <span
              className="role-pill"
              style={getRoleBadgeStyle(user.role)}
            >
              {user.role}
            </span>
          </div>

          <button
            type="button"
            onClick={logout}
            className="btn btn-danger header-logout-btn"
            title="Sign out of system"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
};

export default CompactHeader;
