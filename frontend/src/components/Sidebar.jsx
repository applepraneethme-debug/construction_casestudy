import React from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Reusable Left Sidebar Navigation Component
 * Features:
 * - Persistent desktop sidebar with collapse/expand toggle
 * - Mobile drawer mode with backdrop overlay
 * - Role-aware navigation using existing permission logic
 * - Accessible active states and clean icon + label presentation
 */
const Sidebar = ({
  activeTab,
  onSelectTab,
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen
}) => {
  const { user } = useAuth();

  if (!user) return null;

  const isOwner = user.role === 'Owner';
  const isManager = user.role === 'Material Manager';
  const isEngineer = user.role === 'Site Engineer / Project Manager' || user.role === 'Site Engineer';
  const isKeeper = user.role === 'Storekeeper';

  // Navigation Items with Permission Flags
  const navItems = [
    {
      id: 'overview',
      label: 'Overview',
      icon: '📊',
      visible: true
    },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: '📦',
      visible: true
    },
    {
      id: 'projects',
      label: 'Projects & Sites',
      icon: '🏗️',
      visible: isOwner || isManager || isEngineer
    },
    {
      id: 'movements',
      label: 'Stock Movements',
      icon: '🔄',
      visible: isOwner || isManager || isKeeper
    },
    {
      id: 'requisitions',
      label: 'Requisitions',
      icon: '📋',
      visible: true
    },
    {
      id: 'wastage',
      label: 'Consumption & Wastage',
      icon: '📉',
      visible: true
    },
    {
      id: 'users',
      label: 'User Management',
      icon: '👥',
      visible: isOwner
    }
  ];

  const handleNavClick = (tabId) => {
    onSelectTab(tabId);
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsMobileOpen(false)}
          aria-label="Close navigation drawer"
        />
      )}

      {/* Main Sidebar Element */}
      <aside
        className={`app-sidebar ${isCollapsed ? 'collapsed' : 'expanded'} ${isMobileOpen ? 'mobile-open' : ''}`}
        aria-label="Application Sidebar"
      >
        {/* Sidebar Brand Header */}
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <span className="brand-icon">🏗️</span>
            {!isCollapsed && <span className="brand-text">BuildTrack</span>}
          </div>
          {/* Desktop Collapse Toggle Button */}
          <button
            type="button"
            className="sidebar-toggle-btn desktop-only"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? '❯' : '❮'}
          </button>
          {/* Mobile Close Button */}
          <button
            type="button"
            className="sidebar-close-btn mobile-only"
            onClick={() => setIsMobileOpen(false)}
            aria-label="Close navigation drawer"
          >
            ✕
          </button>
        </div>

        {/* Navigation Items List */}
        <nav className="sidebar-nav">
          {navItems
            .filter((item) => item.visible)
            .map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`nav-item-btn ${isActive ? 'active' : ''}`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <span className="nav-item-icon">{item.icon}</span>
                  {!isCollapsed && <span className="nav-item-label">{item.label}</span>}
                  {isActive && !isCollapsed && <span className="nav-active-indicator" />}
                </button>
              );
            })}
        </nav>

        {/* Sidebar Footer with Project Context */}
        <div className="sidebar-footer">
          {!isCollapsed && (
            <div className="footer-context">
              <span className="context-badge">FSD Lab Exp</span>
              <span className="context-sub">v2.0 • MERN Stack</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
