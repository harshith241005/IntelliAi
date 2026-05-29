import React, { useState, useMemo } from 'react';
import { useStream } from '../context/StreamContext';
import { SeverityBadge } from '../components/SeverityBadge';
import { JsonViewer } from '../components/JsonViewer';
import { Search, SlidersHorizontal, Download, CheckSquare, Trash2, Calendar, ShieldAlert } from 'lucide-react';
import { CCTVEvent } from '../types/schema';

interface EventExplorerProps {
  selectedStoreId: string | null;
}

export const EventExplorer: React.FC<EventExplorerProps> = ({ selectedStoreId }) => {
  const { events } = useStream();

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [cameraFilter, setCameraFilter] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());

  // Available unique fields for filters dropdown
  const uniqueZones = useMemo(() => {
    const zones = new Set(events.map(e => e.zone_id));
    return Array.from(zones);
  }, [events]);

  const uniqueCameras = useMemo(() => {
    const cameras = new Set(events.map(e => e.camera_id));
    return Array.from(cameras);
  }, [events]);

  // Handle Filtering
  const filteredEvents = useMemo(() => {
    return events.filter(evt => {
      // 1. Store matching
      if (selectedStoreId && evt.store_id !== selectedStoreId) return false;

      // 2. Search term matching (track_id or message)
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesTrack = evt.track_id?.toLowerCase().includes(query);
        const matchesMsg = evt.payload.message?.toLowerCase().includes(query);
        const matchesEventId = evt.event_id.toLowerCase().includes(query);
        if (!matchesTrack && !matchesMsg && !matchesEventId) return false;
      }

      // 3. Dropdown matchings
      if (severityFilter !== 'all' && evt.severity !== severityFilter) return false;
      if (typeFilter !== 'all' && evt.event_type !== typeFilter) return false;
      if (zoneFilter !== 'all' && evt.zone_id !== zoneFilter) return false;
      if (cameraFilter !== 'all' && evt.camera_id !== cameraFilter) return false;

      return true;
    });
  }, [events, selectedStoreId, searchTerm, severityFilter, typeFilter, zoneFilter, cameraFilter]);

  // Toggle Row Expand
  const toggleRow = (eventId: string) => {
    const next = new Set(expandedRows);
    if (next.has(eventId)) {
      next.delete(eventId);
    } else {
      next.add(eventId);
    }
    setExpandedRows(next);
  };

  // Toggle Single Row Selection
  const toggleSelectRow = (e: React.MouseEvent, eventId: string) => {
    e.stopPropagation();
    const next = new Set(selectedEventIds);
    if (next.has(eventId)) {
      next.delete(eventId);
    } else {
      next.add(eventId);
    }
    setSelectedEventIds(next);
  };

  // Select all items
  const toggleSelectAll = () => {
    if (selectedEventIds.size === filteredEvents.length) {
      setSelectedEventIds(new Set());
    } else {
      setSelectedEventIds(new Set(filteredEvents.map(e => e.event_id)));
    }
  };

  // Export selected items as JSON File
  const exportAsJSON = () => {
    const itemsToExport = events.filter(e => selectedEventIds.has(e.event_id));
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(itemsToExport, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `store_intel_export_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export selected items as CSV
  const exportAsCSV = () => {
    const itemsToExport = events.filter(e => selectedEventIds.has(e.event_id));
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Event ID,Timestamp,Event Type,Camera ID,Zone,Severity,Confidence,Message\n";
    
    itemsToExport.forEach(e => {
      csvContent += `"${e.event_id}","${e.timestamp}","${e.event_type}","${e.camera_id}","${e.zone_id.replace('zone_', '')}","${e.severity}",${e.confidence},"${e.payload.message || ''}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", encodedUri);
    downloadAnchor.setAttribute("download", `store_intel_export_${Date.now()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 1. Header & Filters Toolbar */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>EVENT ARCHIVE EXPLORER</h3>
          
          {/* Bulk actions panel */}
          {selectedEventIds.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(0, 229, 255, 0.08)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--color-cyan)3a' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-cyan)' }}>
                {selectedEventIds.size} SELECTED
              </span>
              <button onClick={exportAsJSON} className="ops-btn ops-btn-secondary" style={{ fontSize: '0.7rem', padding: '4px 8px' }}>
                <Download size={10} /> JSON
              </button>
              <button onClick={exportAsCSV} className="ops-btn ops-btn-secondary" style={{ fontSize: '0.7rem', padding: '4px 8px' }}>
                <Download size={10} /> CSV
              </button>
            </div>
          )}
        </div>

        {/* Filters grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          {/* Global search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Search by Track, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ops-input"
              style={{ width: '100%', paddingLeft: '34px' }}
            />
          </div>

          {/* Severity Dropdown */}
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="ops-select">
            <option value="all">All Severities</option>
            <option value="critical">Critical Only</option>
            <option value="warning">Warning Only</option>
            <option value="info">Info Only</option>
          </select>

          {/* Type Dropdown */}
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="ops-select">
            <option value="all">All Types</option>
            <option value="detection">Detections</option>
            <option value="track_update">Track Updates</option>
            <option value="anomaly">Anomalies</option>
          </select>

          {/* Zones Dropdown */}
          <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} className="ops-select">
            <option value="all">All Zones</option>
            {uniqueZones.map(z => (
              <option key={z} value={z}>{z.replace('zone_', '').toUpperCase()}</option>
            ))}
          </select>

          {/* Cameras Dropdown */}
          <select value={cameraFilter} onChange={(e) => setCameraFilter(e.target.value)} className="ops-select">
            <option value="all">All Cameras</option>
            {uniqueCameras.map(c => (
              <option key={c} value={c}>{c.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Main hybrid table list */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="ops-table">
            <thead>
              <tr>
                <th style={{ width: '40px', padding: '14px 16px' }}>
                  <input
                    type="checkbox"
                    checked={selectedEventIds.size === filteredEvents.length && filteredEvents.length > 0}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th>TIMESTAMP</th>
                <th>EVENT TYPE</th>
                <th>STORE / CAMERA</th>
                <th>ZONE ID</th>
                <th>TRACK ID</th>
                <th>CONFIDENCE</th>
                <th>SEVERITY</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((evt) => {
                const isExpanded = expandedRows.has(evt.event_id);
                const isSelected = selectedEventIds.has(evt.event_id);

                return (
                  <React.Fragment key={evt.event_id}>
                    {/* Normal Row */}
                    <tr
                      onClick={() => toggleRow(evt.event_id)}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'rgba(0, 229, 255, 0.03)' : evt.severity === 'critical' ? 'rgba(255, 23, 68, 0.02)' : 'transparent',
                        borderBottom: isExpanded ? 'none' : '1px solid var(--border-glass)'
                      }}
                    >
                      <td onClick={(e) => toggleSelectRow(e, evt.event_id)}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td className="monospace" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {new Date(evt.timestamp).toLocaleString()}
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: evt.event_type === 'anomaly' ? 'var(--color-amber)' : 'var(--text-primary)'
                          }}
                        >
                          {evt.event_type === 'anomaly' && <ShieldAlert size={12} />}
                          {evt.event_type.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {evt.store_id.replace('store_', 'STORE #')} • <span className="monospace" style={{ color: 'var(--text-secondary)' }}>{evt.camera_id}</span>
                      </td>
                      <td style={{ fontSize: '0.85rem', textTransform: 'capitalize' }}>
                        {evt.zone_id.replace('zone_', '').replace('_', ' ')}
                      </td>
                      <td className="monospace" style={{ fontSize: '0.8rem', color: 'var(--color-cyan)', fontWeight: 600 }}>
                        {evt.track_id || 'N/A'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '40px', height: '4px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${evt.confidence * 100}%`, backgroundColor: 'var(--color-cyan)' }} />
                          </div>
                          <span className="monospace" style={{ fontSize: '0.75rem' }}>{(evt.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td>
                        <SeverityBadge severity={evt.severity} size="sm" />
                      </td>
                      <td>
                        <button
                          className="ops-btn ops-btn-secondary"
                          style={{ fontSize: '0.7rem', padding: '4px 10px', height: '24px' }}
                        >
                          {isExpanded ? 'Collapse' : 'Payload'}
                        </button>
                      </td>
                    </tr>

                    {/* Collapsible details Row */}
                    {isExpanded && (
                      <tr>
                        <td />
                        <td colSpan={8} style={{ padding: '0px 16px 16px 16px', backgroundColor: isSelected ? 'rgba(0, 229, 255, 0.03)' : 'transparent' }}>
                          <div
                            style={{
                              padding: '16px',
                              backgroundColor: 'rgba(0, 0, 0, 0.15)',
                              border: '1px solid var(--border-glass)',
                              borderRadius: '8px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Event Message Context</span>
                                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                                  {evt.payload.message || 'Standard dynamic telemetry tracking tick.'}
                                </span>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                <span className="monospace" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  Correlation ID: {evt.correlation_id || 'none'}
                                </span>
                                <span className="monospace" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  Schema Contract Version: {evt.schema_version}
                                </span>
                              </div>
                            </div>

                            {/* Bounding box details if coordinates present */}
                            {evt.payload.coordinates && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                Target Box: [X: {evt.payload.coordinates.x}, Y: {evt.payload.coordinates.y}, Width: {evt.payload.coordinates.width}, Height: {evt.payload.coordinates.height}]
                                {evt.payload.speed !== undefined && ` • Velocity: ${evt.payload.speed} px/s`}
                                {evt.payload.dwell_time !== undefined && ` • Dwell Duration: ${evt.payload.dwell_time}s`}
                              </div>
                            )}

                            {/* collapsible pretty printer JSON */}
                            <JsonViewer data={evt} defaultExpanded={true} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {filteredEvents.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    No events matched your current operational search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
export default EventExplorer;
