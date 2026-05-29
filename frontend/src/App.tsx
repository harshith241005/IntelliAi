import React, { useState } from 'react';
import { StreamProvider } from './context/StreamContext';
import { ConnectionStatus } from './components/ConnectionStatus';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LiveOps } from './views/LiveOps';
import { EventExplorer } from './views/EventExplorer';
import { AnomalyCenter } from './views/AnomalyCenter';
import { Analytics } from './views/Analytics';
import { CamerasAdmin } from './views/CamerasAdmin';
import { SystemHealth } from './views/SystemHealth';
import {
  LayoutDashboard,
  Database,
  ShieldAlert,
  BarChart3,
  Camera,
  Cpu,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

type ViewType =
  | 'dashboard'
  | 'events'
  | 'anomalies'
  | 'analytics'
  | 'cameras'
  | 'system';

const menuItems = [
  { id: 'dashboard' as const, label: 'Live Operations', icon: LayoutDashboard },
  { id: 'events' as const, label: 'Event Explorer', icon: Database },
  { id: 'anomalies' as const, label: 'Anomaly Center', icon: ShieldAlert },
  { id: 'analytics' as const, label: 'Analytics Insights', icon: BarChart3 },
  { id: 'cameras' as const, label: 'Camera Registry', icon: Camera },
  { id: 'system' as const, label: 'System Observability', icon: Cpu },
];

const MainApp: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  const renderView = () => {
    switch (activeView) {
      case 'events':
        return <EventExplorer />;
      case 'anomalies':
        return <AnomalyCenter />;
      case 'analytics':
        return <Analytics />;
      case 'cameras':
        return <CamerasAdmin />;
      case 'system':
        return <SystemHealth />;
      default:
        return <LiveOps />;
    }
  };

  const title = menuItems.find((m) => m.id === activeView)?.label ?? 'Dashboard';

  return (
    <div className="flex min-h-screen bg-[#0f111a] text-slate-100">
      <aside
        className={`flex flex-col border-r border-white/10 bg-[#161925] p-4 transition-all ${
          collapsed ? 'w-[72px]' : 'w-[240px]'
        }`}
      >
        <div className="mb-8 flex items-center justify-between">
          {!collapsed && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
                Store Intel
              </p>
              <h2 className="text-lg font-bold text-white">AI CCTV MVP</h2>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="rounded p-1 text-slate-400 hover:text-white"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  active
                    ? 'bg-cyan-500/10 text-cyan-400'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="flex flex-1 flex-col p-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-slate-400">
              Real-time store intelligence • YOLOv8 + Socket.IO
            </p>
          </div>
          <ConnectionStatus />
        </header>
        <ErrorBoundary>{renderView()}</ErrorBoundary>
      </main>
    </div>
  );
};

export const App: React.FC = () => (
  <StreamProvider>
    <MainApp />
  </StreamProvider>
);

export default App;
