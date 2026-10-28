import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginView from './components/LoginView';
import OverviewDashboard from './components/OverviewDashboard';
import InventoryManager from './components/InventoryManager';
import ProjectSiteManager from './components/ProjectSiteManager';
import StockMovementLedger from './components/StockMovementLedger';
import RequisitionManager from './components/RequisitionManager';
import WastageManager from './components/WastageManager';
import UserManagement from './components/UserManagement';

/**
 * Main Content Component rendered inside AuthProvider
 */
function MainContent() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  if (authLoading) {
    return (
      <div className="container" style={{ textAlign: 'center', marginTop: '6rem' }}>
        <p style={{ fontSize: '1.25rem', color: '#64748b' }}>⏳ Authenticating session with server...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="container">
      {/* Header and RBAC Navigation */}
      <Navbar activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Module Views */}
      <main>
        {activeTab === 'overview' && (
          <OverviewDashboard onNavigate={setActiveTab} />
        )}

        {activeTab === 'inventory' && (
          <InventoryManager />
        )}

        {activeTab === 'projects' && (
          <ProjectSiteManager />
        )}

        {activeTab === 'movements' && (
          <StockMovementLedger />
        )}

        {activeTab === 'requisitions' && (
          <RequisitionManager />
        )}

        {activeTab === 'wastage' && (
          <WastageManager />
        )}

        {activeTab === 'users' && user.role === 'Owner' && (
          <UserManagement />
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}

export default App;
