import React, { useState, useEffect } from 'react';
import { useStream } from '../context/StreamContext';
import { SeverityBadge } from '../components/SeverityBadge';
import { ShieldAlert, Eye, Search, Filter, AlertTriangle, ArrowUpDown } from 'lucide-react';
import { Incident } from '../types/schema';

interface AnomalyCenterProps {
  selectedStoreId: string | null;
  onNavigateToIncident: (incidentId: string) => void;
}

export const AnomalyCenter: React.FC<AnomalyCenterProps> = ({ selectedStoreId, onNavigateToIncident }) => {
  const { fetchIncidentList, activeCameras } = useStream();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering States
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Load Incidents (active anomalies queue) from DB
  const loadIncidents = async () => {
    setLoading(true);
    const list = await fetchIncidentList();
    setIncidents(list);
    setLoading(false);
  };

  useEffect(() => {
    loadIncidents();
    // Poll queue state every 5 seconds to show newly ingested anomalies
    const interval = setInterval(() => {
      loadIncidents();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Filtered Queue
  const filteredQueue = incidents.filter(inc => {
    // Store filter
    if (selectedStoreId && inc.store_id !== selectedStoreId) return false;
    
    // Anomaly Type filter
    if (typeFilter !== 'all' && inc.anomaly_type !== typeFilter) return false;
    
    // Severity filter
    if (severityFilter !== 'all' && inc.severity !== severityFilter) return false;

    return true;
  });

  // Priority Score sort: sorting score * recency
  const sortedQueue = [...filteredQueue].sort((a, b) => {
    const timeA = new Date(a.sla_started_at).getTime();
    const timeB = new Date(b.sla_started_at).getTime();
    
    // Heuristic Priority Score
    const priorityA = a.score * (1 + timeA / 1e12);
    const priorityB = b.score * (1 + timeB / 1e12);

    return sortOrder === 'desc' ? priorityB - priorityA : priorityA - priorityB;
  });

  const uniqueTypes = Array.from(new Set(incidents.map(i => i.anomaly_type)));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '20px' }}>
      
      {/* 1. Left Side Panel Filters */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: 'fit-content' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={16} color="var(--color-cyan)" />
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>QUEUE FILTERS</h3>
        </div>

        {/* Severity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>SEVERITY LEVEL</span>
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="ops-select" style={{ fontSize: '0.8rem' }}>
            <option value="all">All Levels</option>
            <option value="critical">Critical Only</option>
            <option value="warning">Warning Only</option>
            <option value="info">Info Only</option>
          </select>
        </div>

        {/* Anomaly Category */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>ANOMALY CATEGORY</span>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="ops-select" style={{ fontSize: '0.8rem' }}>
            <option value="all">All Categories</option>
            {uniqueTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* Sort Priority */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>PRIORITY SORT</span>
          <button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="ops-btn ops-btn-secondary"
            style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '8px 12px' }}
          >
            <span>{sortOrder === 'desc' ? 'High Severity' : 'Low Severity'}</span>
            <ArrowUpDown size={12} />
          </button>
        </div>
      </div>

      {/* 2. Right Side: Queue Grid Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>
            PRIORITY ANOMALIES DISPATCH QUEUE ({sortedQueue.length})
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Sorted by Risk Score × Recency
          </span>
        </div>

        {loading && incidents.length === 0 ? (
          <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Polling state from pipeline detectors...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {sortedQueue.map((inc) => {
              const cam = activeCameras.find(c => c.camera_id === inc.camera_id);
              const camName = cam ? cam.name : inc.camera_id;

              return (
                <div
                  key={inc.incident_id}
                  className="glass-panel"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    padding: '16px',
                    borderLeft: `4px solid ${inc.severity === 'critical' ? 'var(--color-red)' : 'var(--color-amber)'}`,
                    position: 'relative'
                  }}
                >
                  {/* Score badge at top right */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      backgroundColor: 'rgba(0, 0, 0, 0.4)',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-glass)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: inc.severity === 'critical' ? 'var(--color-red)' : 'var(--color-amber)'
                    }}
                  >
                    RISK {Math.round(inc.score * 100)}%
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '80%' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {inc.incident_id.toUpperCase()} • {inc.store_id.replace('store_', 'STORE #')}
                    </span>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 800 }}>{inc.anomaly_type.toUpperCase()}</h4>
                  </div>

                  {/* Thumbnail frame view */}
                  {inc.media_url && (
                    <div
                      style={{
                        height: '110px',
                        width: '100%',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        position: 'relative',
                        backgroundColor: '#000',
                        border: '1px solid var(--border-glass)'
                      }}
                    >
                      <img
                        src={inc.media_url}
                        alt="Preview Frame"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: '6px',
                          left: '6px',
                          backgroundColor: 'rgba(15, 17, 26, 0.8)',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '0.6rem',
                          color: '#fff'
                        }}
                      >
                        PREVIEW FRAME
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>Camera: {camName}</span>
                    <span>Zone: {inc.zone_id.replace('zone_', '').toUpperCase()}</span>
                    <span>Timestamp: {new Date(inc.sla_started_at).toLocaleTimeString()}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-glass)', paddingTop: '10px', marginTop: '4px' }}>
                    <SeverityBadge severity={inc.severity} size="sm" />
                    
                    <button
                      onClick={() => onNavigateToIncident(inc.incident_id)}
                      className="ops-btn ops-btn-primary"
                      style={{ fontSize: '0.7rem', padding: '6px 12px' }}
                    >
                      <Eye size={12} /> INVESTIGATE
                    </button>
                  </div>
                </div>
              );
            })}

            {sortedQueue.length === 0 && (
              <div
                style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: '60px',
                  color: 'var(--text-secondary)',
                  backgroundColor: 'rgba(22, 25, 37, 0.4)',
                  borderRadius: '12px',
                  border: '1px dashed var(--border-glass)'
                }}
              >
                <ShieldAlert size={36} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                <h3>Dispatch Queue Empty</h3>
                <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>No active anomaly detections trigger safety limits.</p>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
export default AnomalyCenter;
