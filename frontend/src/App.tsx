import React, { useState } from 'react';
import { StreamProvider, useStream } from './context/StreamContext';
import { ConnectionStatus } from './components/ConnectionStatus';
import { StoreSelector } from './components/StoreSelector';
import { ErrorBoundary } from './components/ErrorBoundary';

// Views
import { LiveOps } from './views/LiveOps';
import { EventExplorer } from './views/EventExplorer';
import { IncidentDetail } from './views/IncidentDetail';
import { AnomalyCenter } from './views/AnomalyCenter';
import { Analytics } from './views/Analytics';
import { CamerasAdmin } from './views/CamerasAdmin';
import { SystemHealth } from './views/SystemHealth';

// Icons
import {
  LayoutDashboard, Database, ShieldAlert, BarChart3, Camera, Cpu,
  Menu, ChevronLeft, ChevronRight, User, Settings
} from 'lucide-react';

type ViewType = 'dashboard' | 'events' | 'anomalies' | 'analytics' | 'cameras' | 'system';

const MainAppContent: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  
  // Sidebar expand state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Navigate directly to incident detail profile (routing handler)
  const handleNavigateToIncident = (incidentId: string) => {
    setSelectedIncidentId(incidentId);
  };

  // Sidebar link items
  const menuItems = [
    { id: 'dashboard', label: 'Live Operations', icon: LayoutDashboard },
    { id: 'events', label: 'Event Explorer', icon: Database },
    { id: 'anomalies', label: 'Anomaly Center', icon: ShieldAlert },
    { id: 'analytics', label: 'Analytics Insights', icon: BarChart3 },
    { id: 'cameras', label: 'Cameras Registry', icon: Camera },
    { id: 'system', label: 'System Observability', icon: Cpu },
  ] as const;

  // Render view depending on navigation state
  const renderActiveView = () => {
    // If routing direct to incident detail profile
    if (selectedIncidentId) {
      return (
        <IncidentDetail
          incidentId={selectedIncidentId}
          onBack={() => setSelectedIncidentId(null)}
        />
      );
    }

    switch (activeView) {
      case 'events':
        return <EventExplorer selectedStoreId={selectedStoreId} />;
      case 'anomalies':
        return (
          <AnomalyCenter
            selectedStoreId={selectedStoreId}
            onNavigateToIncident={handleNavigateToIncident}
          />
        );
      case 'analytics':
        return <Analytics selectedStoreId={selectedStoreId} />;
      case 'cameras':
        return <CamerasAdmin selectedStoreId={selectedStoreId} />;
      case 'system':
        return <SystemHealth />;
      case 'dashboard':
      default:
        return (
          <LiveOps
            selectedStoreId={selectedStoreId}
            onNavigateToIncident={handleNavigateToIncident}
          />
        );
    }
  };

  const getPageTitle = () => {
    if (selectedIncidentId) return `Security Incident Details`;
    const found = menuItems.find(m => m.id === activeView);
    return found ? found.label : 'Operations Console';
  };

  return (
    <div className="app-container">
      
      {/* 1. Collapsible Sidebar */}
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        
        {/* Brand/Logo header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'space-between', marginBottom: '32px' }}>
          {!isSidebarCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ backgroundColor: 'var(--color-cyan)15', border: '1px solid var(--color-cyan)3a', color: 'var(--color-cyan)', borderRadius: '8px', padding: '6px', display: 'flex', alignItems: 'center' }}>
                <ShieldAlert size={18} />
              </div>
              <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em', color: '#fff' }}>
                INTELLI AI
              </span>
            </div>
          )}

          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px'
            }}
          >
            {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Sidebar Nav links */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          {menuItems.map((item) => {
            const isLinkActive = activeView === item.id && !selectedIncidentId;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveView(item.id);
                  setSelectedIncidentId(null); // clear detail state when changing views
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: isLinkActive ? 600 : 500,
                  transition: 'all var(--transition-fast)',
                  backgroundColor: isLinkActive ? 'rgba(0, 229, 255, 0.08)' : 'transparent',
                  color: isLinkActive ? 'var(--color-cyan)' : 'var(--text-secondary)',
                  justifyContent: isSidebarCollapsed ? 'center' : 'flex-start'
                }}
              >
                <Icon size={18} />
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Bottom Operator profile block */}
        <div
          style={{
            borderTop: '1px solid var(--border-glass)',
            paddingTop: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            justifyContent: isSidebarCollapsed ? 'center' : 'flex-start'
          }}
        >
          <div style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: '50%', padding: '8px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
            <User size={16} />
          </div>
          {!isSidebarCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Operator Alex</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>ops-monitor-level-2</span>
            </div>
          )}
        </div>

      </aside>

      {/* 2. Main content area wrapper */}
      <main className="main-content">
        
        {/* Top Header bar */}
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '28px',
            flexWrap: 'wrap',
            gap: '16px',
            borderBottom: '1px solid var(--border-glass)',
            paddingBottom: '20px'
          }}
        >
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              {getPageTitle()}
            </h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Store Intelligence Ops Console • Live Ingestion Pipeline
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            {/* Store fleet selector dropdown */}
            {!selectedIncidentId && (
              <StoreSelector
                selectedStoreId={selectedStoreId}
                onSelectStore={setSelectedStoreId}
              />
            )}

            {/* Ingestion Stream Health status pill */}
            <ConnectionStatus />
          </div>
        </header>

        {/* 3. Page viewport mounted with Error boundary protection */}
        <ErrorBoundary>
          {renderActiveView()}
        </ErrorBoundary>

      </main>

    </div>
  );
};

export const App: React.FC = () => {
  return (
    <StreamProvider>
      <MainAppContent />
    </StreamProvider>
  );
};
export default App;
