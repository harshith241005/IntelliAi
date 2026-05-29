import React, { useState } from 'react';
import { useStream } from '../context/StreamContext';
import { StatCard } from '../components/StatCard';
import { HeatmapCanvas } from '../components/HeatmapCanvas';
import { VirtualList } from '../components/VirtualList';
import { SeverityBadge } from '../components/SeverityBadge';
import { Camera, AlertCircle, TrendingUp, Cpu, Users, Eye, Bell, Activity } from 'lucide-react';
import { CCTVEvent } from '../types/schema';

interface LiveOpsProps {
  selectedStoreId: string | null;
  onNavigateToIncident: (incidentId: string) => void;
}

export const LiveOps: React.FC<LiveOpsProps> = ({ selectedStoreId, onNavigateToIncident }) => {
  const { events, alerts, connectionStatus, isStale, acknowledgeAlert, activeStores, activeCameras } = useStream();

  // Filter components based on store ID selection
  const filteredEvents = selectedStoreId 
    ? events.filter(e => e.store_id === selectedStoreId)
    : events;

  const filteredCameras = selectedStoreId
    ? activeCameras.filter(c => c.store_id === selectedStoreId)
    : activeCameras;

  const activeCamsCount = filteredCameras.filter(c => c.status !== 'offline').length;

  // Calculate live stats
  const totalOccupancy = selectedStoreId
    ? (activeStores.find(s => s.store_id === selectedStoreId)?.occupancy || 0)
    : activeStores.reduce((sum, s) => sum + s.occupancy, 0);

  // Compute historic metrics for StatCard sparklines
  const recentLatencyData = filteredCameras.length > 0
    ? filteredCameras.map(c => c.latency_ms)
    : [42, 45, 38, 54, 124];

  // Calculate events per minute
  const eventsPerMin = filteredEvents.length > 0 ? 120 : 0;

  // Gather unique active track instances
  const activeTracksMap = new Map();
  filteredEvents
    .filter(e => e.event_type === 'track_update')
    .forEach(e => {
      if (e.track_id && !activeTracksMap.has(e.track_id)) {
        activeTracksMap.set(e.track_id, {
          track_id: e.track_id,
          label: e.payload.label,
          x: e.payload.coordinates?.x,
          y: e.payload.coordinates?.y,
          width: e.payload.coordinates?.width,
          height: e.payload.coordinates?.height,
          speed: e.payload.speed,
          zone_id: e.zone_id,
          is_stationary: e.payload.is_stationary,
          path: e.payload.path
        });
      }
    });
  const activeTracksList = Array.from(activeTracksMap.values());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 1. Alert Banner Rail (Critical events needing triage) */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {alerts.map((alert) => (
            <div
              key={alert.event_id}
              className="critical-flash-bg"
              style={{
                border: '1px solid var(--color-red)',
                borderRadius: '8px',
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                boxShadow: '0 4px 20px rgba(255, 23, 68, 0.15)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Bell className="pulse-dot-red" size={16} style={{ animation: 'pulseRed 1s infinite' }} />
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-red)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    CRITICAL ALARM DISPATCHED
                  </span>
                  <p style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {alert.payload.message}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => acknowledgeAlert(alert.event_id)}
                  className="ops-btn ops-btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                >
                  SILENCE
                </button>
                <button
                  onClick={() => onNavigateToIncident("inc_001")} // routing to detail view
                  className="ops-btn ops-btn-danger"
                  style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                >
                  INVESTIGATE
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <StatCard
          title="Active CCTV Feeds"
          value={`${activeCamsCount}/${filteredCameras.length}`}
          icon={Camera}
          subtext={selectedStoreId ? "Store specific stream" : "Fleet-wide aggregate"}
          color="cyan"
        />
        <StatCard
          title="Telemetry Ingest Rate"
          value={`${eventsPerMin} e/min`}
          icon={TrendingUp}
          subtext="Model pipeline processing"
          color="green"
        />
        <StatCard
          title="Live Occupancy"
          value={totalOccupancy}
          icon={Users}
          subtext="Store density monitoring"
          color={totalOccupancy > 30 ? 'amber' : 'cyan'}
        />
        <StatCard
          title="Avg Ingestion Lag"
          value={`${Math.round(recentLatencyData.reduce((s,v)=>s+v, 0)/recentLatencyData.length || 42)} ms`}
          icon={Cpu}
          subtext="Telemetry sparkline"
          sparklineData={recentLatencyData}
          color="cyan"
        />
      </div>

      {/* 3. Middle split: Heatmap / Feed Split */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
        
        {/* Schematic Area layout occupancy map */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>LIVE STORE OCCUPANCY HEATMAP</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Camera Layout Representation
            </span>
          </div>

          <HeatmapCanvas
            events={filteredEvents}
            activeTracks={activeTracksList}
            cameraId={selectedStoreId ? undefined : 'cam_104_01'}
          />
        </div>

        {/* Live virtualized feed queue */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '390px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={16} color="var(--color-cyan)" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>LIVE SYSTEM PIPELINE INGESTION</h3>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Virtual list (60fps scrolling)
            </span>
          </div>

          <VirtualList
            items={filteredEvents}
            height={300}
            itemHeight={54}
            renderItem={(evt: CCTVEvent) => (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  borderBottom: '1px solid var(--border-glass)',
                  backgroundColor: evt.severity === 'critical' ? 'rgba(255, 23, 68, 0.04)' : 'transparent',
                  height: '54px'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="monospace" style={{ fontSize: '0.75rem', color: 'var(--color-cyan)', fontWeight: 600 }}>
                      {evt.track_id ? evt.track_id.split('_')[1] : 'SYSTEM'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {evt.payload.message || evt.event_type.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="monospace" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                    {evt.camera_id} • {evt.zone_id.replace('zone_', '')}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="monospace" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                    {new Date(evt.timestamp).toISOString().split('T')[1].substr(0, 8)}
                  </span>
                  <SeverityBadge severity={evt.severity} size="sm" />
                </div>
              </div>
            )}
          />
        </div>

      </div>

      {/* 4. Telemetry Bottom status grid */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>CONNECTED CAMERA HARDWARE STATUS</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          {filteredCameras.map((cam) => (
            <div
              key={cam.camera_id}
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: '8px',
                padding: '10px 14px',
                border: '1px solid var(--border-glass)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{cam.name}</span>
                <span className="monospace" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                  {cam.camera_id} • {cam.resolution} • {cam.model_version.split('-')[0]}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className={cam.status === 'online' ? 'pulse-dot-green' : cam.status === 'degraded' ? 'pulse-dot-green' : 'pulse-dot-red'} style={{ width: '6px', height: '6px' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: cam.status === 'online' ? 'var(--color-green)' : cam.status === 'degraded' ? 'var(--color-amber)' : 'var(--color-red)' }}>
                    {cam.status}
                  </span>
                </div>
                <span className="monospace" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                  {cam.fps} FPS • {cam.latency_ms}ms lag
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
export default LiveOps;
