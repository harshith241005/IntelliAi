import React, { useState } from 'react';
import { useStream } from '../context/StreamContext';
import { MediaPlayer } from '../components/MediaPlayer';
import { Settings, Play, ShieldAlert, Cpu, ToggleLeft, ToggleRight, Radio, RefreshCw, Power } from 'lucide-react';

interface CamerasAdminProps {
  selectedStoreId: string | null;
}

export const CamerasAdmin: React.FC<CamerasAdminProps> = ({ selectedStoreId }) => {
  const { activeCameras, activeStores, triggerMockBreach, refreshMetadata } = useStream();
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  
  // Toggling controls loading indicators
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // Filter cameras
  const filteredCameras = selectedStoreId
    ? activeCameras.filter(c => c.store_id === selectedStoreId)
    : activeCameras;

  const currentCamProfile = activeCameras.find(c => c.camera_id === selectedCameraId);

  // Handle adjusting camera remote options (turning stream on/off or scaling FPS)
  const adjustCameraControl = async (cameraId: string, status: string, fps?: number) => {
    setIsUpdating(cameraId);
    try {
      const res = await fetch(`http://localhost:3001/api/cameras/${cameraId}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, fps })
      });
      if (res.ok) {
        refreshMetadata();
      }
    } catch (e) {
      console.error("Failed to post camera settings update:", e);
    }
    setIsUpdating(null);
  };

  // Dispatch manual security breach simulation
  const handleIntrusionTrigger = async (cameraId: string) => {
    setIsUpdating(cameraId);
    const success = await triggerMockBreach(cameraId);
    if (success) {
      alert(`Pipeline Security Breach Event successfully injected into ${cameraId}. Check the Live Dashboard alerts!`);
      refreshMetadata();
    }
    setIsUpdating(null);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: currentCamProfile ? '1.1fr 1fr' : '1fr', gap: '20px', transition: 'all 300ms' }}>
      
      {/* 1. Left Grid list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>CAMERA HARDWARE TELEMETRY GRID</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Real-time FPS drifts & model telemetry indicators
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {filteredCameras.map((cam) => {
            const isSelected = selectedCameraId === cam.camera_id;
            
            return (
              <div
                key={cam.camera_id}
                onClick={() => setSelectedCameraId(cam.camera_id)}
                className="glass-panel"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  cursor: 'pointer',
                  border: isSelected ? '1px solid var(--color-cyan)' : '1px solid var(--border-glass)',
                  backgroundColor: isSelected ? 'rgba(0, 229, 255, 0.02)' : 'var(--bg-glass)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{cam.name}</span>
                    <span className="monospace" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                      {cam.camera_id} • {cam.resolution}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className={cam.status === 'online' ? 'pulse-dot-green' : cam.status === 'degraded' ? 'pulse-dot-green' : 'pulse-dot-red'} style={{ width: '6px', height: '6px' }} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: cam.status === 'online' ? 'var(--color-green)' : cam.status === 'degraded' ? 'var(--color-amber)' : 'var(--color-red)' }}>
                      {cam.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Healthbar gauge */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                    <span>Stream Health Telemetry</span>
                    <span className="monospace">{cam.stream_health.toFixed(1)}%</span>
                  </div>
                  <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${cam.stream_health}%`, backgroundColor: cam.stream_health > 90 ? 'var(--color-green)' : cam.stream_health > 60 ? 'var(--color-amber)' : 'var(--color-red)' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', borderTop: '1px solid var(--border-glass)', paddingTop: '10px', marginTop: '4px' }}>
                  <span className="monospace" style={{ color: 'var(--text-secondary)' }}>
                    FPS: {cam.fps} • Drop: {cam.frame_drop_rate}%
                  </span>
                  
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    Lag: {cam.latency_ms}ms
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Right drawer: Camera focus details, live feeds and settings adjustment */}
      {currentCamProfile && (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: 'fit-content' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={16} className="spin-reconnect" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800 }}>CAMERA STREAM CONFIGURATOR</h3>
            </div>
            <button
              onClick={() => setSelectedCameraId(null)}
              className="ops-btn ops-btn-secondary"
              style={{ fontSize: '0.7rem', padding: '4px 8px' }}
            >
              Close Config
            </button>
          </div>

          {/* CCTV Feed Preview */}
          <MediaPlayer
            cameraId={currentCamProfile.camera_id}
            cameraName={currentCamProfile.name}
            activeTracks={[]} // no overlays in config screen to keep raw display
          />

          {/* Settings Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px solid var(--border-glass)', paddingTop: '16px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Stream Operational Power</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  Disable ingestion feed representing hardware service
                </span>
              </div>

              <button
                onClick={() => adjustCameraControl(
                  currentCamProfile.camera_id,
                  currentCamProfile.status === 'offline' ? 'online' : 'offline'
                )}
                disabled={isUpdating === currentCamProfile.camera_id}
                className="ops-btn"
                style={{
                  backgroundColor: currentCamProfile.status === 'offline' ? 'rgba(0, 230, 118, 0.12)' : 'rgba(255, 23, 68, 0.12)',
                  color: currentCamProfile.status === 'offline' ? 'var(--color-green)' : 'var(--color-red)',
                  border: `1px solid ${currentCamProfile.status === 'offline' ? 'rgba(0, 230, 118, 0.25)' : 'rgba(255, 23, 68, 0.25)'}`,
                  fontSize: '0.75rem',
                  padding: '6px 12px'
                }}
              >
                <Power size={12} />
                <span>{currentCamProfile.status === 'offline' ? 'POWER ON' : 'POWER OFF'}</span>
              </button>
            </div>

            {/* Adjust FPS */}
            {currentCamProfile.status !== 'offline' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Telemetry Tickrate limit</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    Scale downstream frame updates rate (FPS)
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {[10, 20, 30].map(fpsVal => (
                    <button
                      key={fpsVal}
                      onClick={() => adjustCameraControl(currentCamProfile.camera_id, currentCamProfile.status, fpsVal)}
                      disabled={isUpdating === currentCamProfile.camera_id}
                      className="ops-btn"
                      style={{
                        backgroundColor: currentCamProfile.fps === fpsVal ? 'rgba(0, 229, 255, 0.2)' : 'var(--bg-tertiary)',
                        border: `1px solid ${currentCamProfile.fps === fpsVal ? 'var(--color-cyan)' : 'var(--border-glass)'}`,
                        color: currentCamProfile.fps === fpsVal ? 'var(--color-cyan)' : '#fff',
                        fontSize: '0.7rem',
                        padding: '4px 10px'
                      }}
                    >
                      {fpsVal}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Manual Breach testing triggers */}
            {currentCamProfile.status !== 'offline' && (
              <div
                style={{
                  backgroundColor: 'rgba(255, 23, 68, 0.04)',
                  border: '1px solid rgba(255, 23, 68, 0.15)',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  marginTop: '6px'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-red)' }}>
                    INTEGRITY PIPELINE BREACH TESTER
                  </span>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    Inject manual critical vector intrusion inside restricted coordinate borders to verify downstream triage alerts and SLA timers instantly.
                  </p>
                </div>

                <button
                  onClick={() => handleIntrusionTrigger(currentCamProfile.camera_id)}
                  disabled={isUpdating === currentCamProfile.camera_id}
                  className="ops-btn ops-btn-danger"
                  style={{ display: 'flex', justifyContent: 'center', fontSize: '0.75rem', padding: '8px 12px', width: '100%', marginTop: '4px' }}
                >
                  <ShieldAlert size={14} /> FORCE SECURITY BREACH
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
export default CamerasAdmin;
