import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { CCTVEvent, Store, Camera, Incident } from '../types/schema';

interface StreamContextType {
  events: CCTVEvent[];
  alerts: CCTVEvent[];
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  isStale: boolean;
  acknowledgeAlert: (eventId: string) => void;
  triggerMockBreach: (cameraId: string) => Promise<boolean>;
  activeStores: Store[];
  activeCameras: Camera[];
  fetchIncidentList: () => Promise<Incident[]>;
  updateIncidentTriage: (incidentId: string, status: string, assignedTo: string, note?: string) => Promise<boolean>;
  refreshMetadata: () => void;
}

const StreamContext = createContext<StreamContextType | undefined>(undefined);

export const useStream = () => {
  const context = useContext(StreamContext);
  if (!context) throw new Error("useStream must be used within a StreamProvider");
  return context;
};

export const StreamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<CCTVEvent[]>([]);
  const [alerts, setAlerts] = useState<CCTVEvent[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<StreamContextType['connectionStatus']>('connecting');
  const [isStale, setIsStale] = useState(false);
  const [activeStores, setActiveStores] = useState<Store[]>([]);
  const [activeCameras, setActiveCameras] = useState<Camera[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const lastEventTimeRef = useRef<number>(Date.now());
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);

  // Load stores and cameras from backend REST APIs
  const fetchMetadata = useCallback(async () => {
    try {
      const storesRes = await fetch('/api/v1/stores');
      const camerasRes = await fetch('/api/v1/cameras');
      if (storesRes.ok && camerasRes.ok) {
        const stores = await storesRes.json();
        const cameras = await camerasRes.json();
        setActiveStores(stores);
        setActiveCameras(cameras);
      }
    } catch (e) {
      console.warn("Failed to fetch operational stores/cameras metadata:", e);
    }
  }, []);

  // Fetch incidents list
  const fetchIncidentList = useCallback(async (): Promise<Incident[]> => {
    try {
      const res = await fetch('/api/v1/incidents');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error("Failed to fetch incidents list:", e);
    }
    return [];
  }, []);

  // Triaging incidents
  const updateIncidentTriage = useCallback(async (
    incidentId: string,
    status: string,
    assignedTo: string,
    note?: string
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/v1/incidents/${incidentId}?status=${status}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note })
      });
      if (res.ok) {
        // Refresh stores/cameras status in-app immediately after triage update
        fetchMetadata();
        return true;
      }
    } catch (e) {
      console.error("Failed to update incident triage:", e);
    }
    return false;
  }, [fetchMetadata]);

  // Manually trigger dynamic security breach for camera pipeline testing
  const triggerMockBreach = useCallback(async (cameraId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/v1/cameras/${cameraId}/trigger-breach`, {
        method: 'POST'
      });
      return res.ok;
    } catch (e) {
      console.error("Failed to trigger security breach simulation:", e);
      return false;
    }
  }, []);

  // Connect WebSocket to backend server
  const connectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setConnectionStatus('connecting');
    console.log("Connecting WebSocket to ws://localhost:8000/api/v1/events/stream...");
    
    const ws = new WebSocket('ws://localhost:8000/api/v1/events/stream');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket stream connected successfully.");
      setConnectionStatus('connected');
      setIsStale(false);
      reconnectAttemptsRef.current = 0;
      lastEventTimeRef.current = Date.now();
      
      // Load/refresh current REST data on connect
      fetchMetadata();
    };

    ws.onmessage = (messageEvent) => {
      try {
        const event: CCTVEvent = JSON.parse(messageEvent.data);
        lastEventTimeRef.current = Date.now();
        setIsStale(false);

        // 1. Buffer rolling live events (capped at 500 records to prevent browser memory leaks)
        setEvents((prev) => {
          const next = [event, ...prev];
          if (next.length > 500) {
            next.pop();
          }
          return next;
        });

        // 2. Buffer alerts if anomaly detected with severity high/critical
        if (event.event_type === 'anomaly' && event.severity === 'critical') {
          setAlerts((prev) => {
            // Avoid duplicate notifications in alert banner rail
            if (prev.some(a => a.event_id === event.event_id || a.track_id === event.track_id)) {
              return prev;
            }
            return [event, ...prev];
          });
        }
      } catch (err) {
        console.error("Error parsing streaming WebSocket JSON frame:", err);
      }
    };

    ws.onclose = () => {
      console.warn("WebSocket stream connection severed.");
      setConnectionStatus('disconnected');
      
      // Exponential backoff reconnect
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      reconnectAttemptsRef.current++;
      
      console.log(`Scheduling reconnect attempt in ${delay}ms...`);
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connectWebSocket();
      }, delay);
    };

    ws.onerror = (err) => {
      console.error("WebSocket client connection error:", err);
    };
  }, [fetchMetadata]);

  // Acknowledge critical alerts
  const acknowledgeAlert = useCallback((eventId: string) => {
    setAlerts((prev) => prev.filter(a => a.event_id !== eventId));
  }, []);

  // Periodic metadata poll + stale-data health checks
  useEffect(() => {
    connectWebSocket();

    // Check if data is stale: no messages received in past 5 seconds
    const staleInterval = setInterval(() => {
      const timeSinceLastMsg = Date.now() - lastEventTimeRef.current;
      if (timeSinceLastMsg > 5000 && connectionStatus === 'connected') {
        setIsStale(true);
      }
    }, 1000);

    // Poll stores and cameras statistics once every 10 seconds to sync REST database values
    const metadataInterval = setInterval(() => {
      if (connectionStatus === 'connected') {
        fetchMetadata();
      }
    }, 10000);

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      clearInterval(staleInterval);
      clearInterval(metadataInterval);
    };
  }, [connectWebSocket, connectionStatus, fetchMetadata]);

  return (
    <StreamContext.Provider value={{
      events,
      alerts,
      connectionStatus,
      isStale,
      acknowledgeAlert,
      triggerMockBreach,
      activeStores,
      activeCameras,
      fetchIncidentList,
      updateIncidentTriage,
      refreshMetadata: fetchMetadata
    }}>
      {children}
    </StreamContext.Provider>
  );
};
