import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import CompactHeader from './components/CompactHeader';
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  if (authLoading) {
    return (
      <div className="loading-screen">
        <p>⏳ Authenticating session with server...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className={`app-layout ${isSidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
      {/* Left Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
      />

      {/* Main Content Area */}
      <div className="app-main-content">
        <CompactHeader
          activeTab={activeTab}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />

        {/* Module Views */}
        <main className="module-container">
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

