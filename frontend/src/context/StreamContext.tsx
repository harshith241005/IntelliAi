import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Alert, Camera, DashboardStats, StoreEvent } from '../types/schema';

interface StreamContextType {
  events: StoreEvent[];
  alerts: Alert[];
  cameras: Camera[];
  dashboard: DashboardStats | null;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  silenceAlert: (alertId: string) => Promise<void>;
  investigateAlert: (alertId: string) => Promise<void>;
  refreshCameras: () => Promise<void>;
}

const StreamContext = createContext<StreamContextType | undefined>(undefined);

const API = '/api';

export const useStream = () => {
  const ctx = useContext(StreamContext);
  if (!ctx) throw new Error('useStream must be used within StreamProvider');
  return ctx;
};

export const StreamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<StoreEvent[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<StreamContextType['connectionStatus']>('connecting');

  const refreshCameras = useCallback(async () => {
    try {
      const res = await fetch(`${API}/cameras`);
      if (res.ok) setCameras(await res.json());
    } catch {
      /* backend may be starting */
    }
  }, []);

  const loadInitial = useCallback(async () => {
    await refreshCameras();
    try {
      const [evRes, alRes, dashRes] = await Promise.all([
        fetch(`${API}/events?limit=200`),
        fetch(`${API}/alerts?status=active`),
        fetch(`${API}/dashboard/stats`),
      ]);
      if (evRes.ok) setEvents(await evRes.json());
      if (alRes.ok) setAlerts(await alRes.json());
      if (dashRes.ok) setDashboard(await dashRes.json());
    } catch {
      /* ignore */
    }
  }, [refreshCameras]);

  const silenceAlert = useCallback(async (alertId: string) => {
    await fetch(`${API}/alerts/${alertId}/silence`, { method: 'POST' });
    setAlerts((prev) => prev.filter((a) => a.alert_id !== alertId));
  }, []);

  const investigateAlert = useCallback(async (alertId: string) => {
    await fetch(`${API}/alerts/${alertId}/investigate`, { method: 'POST' });
    setAlerts((prev) => prev.filter((a) => a.alert_id !== alertId));
  }, []);

  useEffect(() => {
    loadInitial();

    const socket: Socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socket.on('connect', () => {
      setConnectionStatus('connected');
      loadInitial();
    });

    socket.on('disconnect', () => setConnectionStatus('disconnected'));

    socket.on('connect_error', () => setConnectionStatus('connecting'));

    socket.on('event', (event: StoreEvent) => {
      setEvents((prev) => [event, ...prev].slice(0, 500));
      if (event.severity === 'critical' || event.severity === 'high') {
        setAlerts((prev) => {
          const synthetic: Alert = {
            alert_id: `live_${event.event_id}`,
            type: event.event_type,
            status: 'active',
            camera_id: event.camera_id,
            severity: event.severity as Alert['severity'],
            message: event.message || event.event_type,
            created_at: event.timestamp,
            event_id: event.event_id,
          };
          if (prev.some((a) => a.event_id === event.event_id)) return prev;
          return [synthetic, ...prev].slice(0, 20);
        });
      }
    });

    socket.on('alert', (alert: Alert) => {
      setAlerts((prev) => {
        if (prev.some((a) => a.alert_id === alert.alert_id)) return prev;
        return [alert, ...prev].slice(0, 20);
      });
    });

    socket.on('dashboard', (stats: DashboardStats) => setDashboard(stats));

    return () => {
      socket.disconnect();
    };
  }, [loadInitial]);

  return (
    <StreamContext.Provider
      value={{
        events,
        alerts,
        cameras,
        dashboard,
        connectionStatus,
        silenceAlert,
        investigateAlert,
        refreshCameras,
      }}
    >
      {children}
    </StreamContext.Provider>
  );
};
