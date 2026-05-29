import React, { useState, useEffect } from 'react';
import { useStream } from '../context/StreamContext';
import { SeverityBadge } from '../components/SeverityBadge';
import { MediaPlayer } from '../components/MediaPlayer';
import { HeatmapCanvas } from '../components/HeatmapCanvas';
import { ChevronLeft, Clock, ShieldAlert, Send, CheckCircle, UserCheck, ShieldAlert as AlertIcon } from 'lucide-react';
import { Incident } from '../types/schema';

interface IncidentDetailProps {
  incidentId: string | null;
  onBack: () => void;
}

export const IncidentDetail: React.FC<IncidentDetailProps> = ({ incidentId, onBack }) => {
  const { fetchIncidentList, updateIncidentTriage, activeCameras, events } = useStream();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Operator Triage fields
  const [noteInput, setNoteInput] = useState('');
  const [operatorName, setOperatorName] = useState('Operator Alex');
  const [isSaving, setIsSaving] = useState(false);

  // SLA Timer state
  const [elapsedTime, setElapsedTime] = useState('00:00');

  // Load specific incident details from backend
  const loadIncident = async () => {
    if (!incidentId) return;
    setLoading(true);
    const list = await fetchIncidentList();
    const found = list.find(i => i.incident_id === incidentId);
    if (found) {
      setIncident(found);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadIncident();
  }, [incidentId]);

  // SLA Elapsed timer logic
  useEffect(() => {
    if (!incident || incident.status === 'resolved') return;

    const timer = setInterval(() => {
      const start = new Date(incident.sla_started_at).getTime();
      const now = Date.now();
      const diffSec = Math.floor((now - start) / 1000);
      
      const mins = Math.floor(diffSec / 60);
      const secs = diffSec % 60;
      setElapsedTime(
        `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [incident]);

  // Triage Action Handlers
  const handleTriageAction = async (newStatus: string, assignedTo: string, noteText?: string) => {
    if (!incident) return;
    setIsSaving(true);
    
    const success = await updateIncidentTriage(
      incident.incident_id,
      newStatus,
      assignedTo,
      noteText
    );

    if (success) {
      if (noteText) setNoteInput('');
      // Reload state
      await loadIncident();
    }
    setIsSaving(false);
  };

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading incident coordinates & video streams...
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
        <h3>Incident Not Found</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>The incident profile may have expired.</p>
        <button onClick={onBack} className="ops-btn ops-btn-secondary" style={{ marginTop: '16px' }}>
          Back to Live Ops
        </button>
      </div>
    );
  }

  // Get camera description
  const camera = activeCameras.find(c => c.camera_id === incident.camera_id);
  const cameraName = camera ? camera.name : incident.camera_id;

  // Filter events matching our track to draw the timeline
  const correlatedEvents = events
    .filter(e => e.track_id === incident.track_id)
    .slice(0, 10); // last 10 ticks

  // Format track list for Heatmap preview
  const trackObj = {
    track_id: incident.track_id,
    label: incident.anomaly_type.includes('Object') ? 'backpack' : 'person',
    x: 88, // static preview coordinates matching seed
    y: 85,
    width: 24,
    height: 48,
    zone_id: incident.zone_id,
    path: [{ x: 88, y: 85 }],
    is_stationary: true
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 1. Header Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <button onClick={onBack} className="ops-btn ops-btn-secondary" style={{ padding: '8px 14px' }}>
          <ChevronLeft size={16} /> BACK TO MONITORING
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Clock size={16} color="var(--text-secondary)" />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>SLA ACTIVE TIMER</span>
          <span className="monospace" style={{ fontSize: '1.2rem', fontWeight: 800, color: incident.status === 'resolved' ? 'var(--color-green)' : 'var(--color-red)' }}>
            {incident.status === 'resolved' ? 'RESOLVED' : elapsedTime}
          </span>
        </div>
      </div>

      {/* 2. Top details row */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <div style={{ backgroundColor: 'rgba(255, 23, 68, 0.1)', border: '1px solid rgba(255, 23, 68, 0.25)', borderRadius: '10px', padding: '10px', color: 'var(--color-red)' }}>
            <ShieldAlert size={22} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="monospace" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{incident.incident_id.toUpperCase()}</span>
              <SeverityBadge severity={incident.severity} size="sm" />
              <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-tertiary)', fontWeight: 600, color: incident.status === 'resolved' ? 'var(--color-green)' : 'var(--color-amber)' }}>
                {incident.status.toUpperCase()}
              </span>
            </div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>{incident.anomaly_type.toUpperCase()}</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Location: {incident.store_id.replace('store_', 'STORE #')} • Camera: {cameraName} ({incident.camera_id})
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {incident.status !== 'investigating' && incident.status !== 'resolved' && (
            <button
              onClick={() => handleTriageAction('investigating', operatorName, "Operator claiming incident workspace to begin analysis.")}
              disabled={isSaving}
              className="ops-btn ops-btn-primary"
            >
              <UserCheck size={14} /> CLAIM WORKSPACE
            </button>
          )}

          {incident.status !== 'resolved' && (
            <button
              onClick={() => handleTriageAction('resolved', operatorName, "Operator resolved security ticket: threat neutralized / false positive logged.")}
              disabled={isSaving}
              className="ops-btn ops-btn-secondary"
              style={{ borderColor: 'var(--color-green)', color: 'var(--color-green)' }}
            >
              <CheckCircle size={14} /> MARK RESOLVED
            </button>
          )}
        </div>
      </div>

      {/* 3. Media Panel & Track Path split */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
        
        {/* CCTV Monitor Panel */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>REAL-TIME CCTV STREAM PLAYBACK</h3>
          <MediaPlayer
            cameraId={incident.camera_id}
            cameraName={cameraName}
            activeTracks={correlatedEvents.length > 0 ? correlatedEvents : [trackObj]}
          />
        </div>

        {/* 2D Schematic Canvas Path */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>ENTITY VECTOR TRAJECTORY</h3>
          <HeatmapCanvas
            events={[]}
            activeTracks={[trackObj]}
            cameraId={incident.camera_id}
          />
        </div>

      </div>

      {/* 4. Incident Timeline & Operator Notes split */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.3fr', gap: '20px' }}>
        
        {/* Timeline of Correlated Events */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>PIPELINE ANOMALY CORRELATION TIMELINE</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', paddingLeft: '20px', borderLeft: '1px dashed var(--border-glass)', marginLeft: '10px', marginTop: '10px' }}>
            
            {/* Event 1: Critical alert */}
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '-25px', top: '2px', backgroundColor: 'var(--color-red)', width: '9px', height: '9px', borderRadius: '50%', boxShadow: '0 0 8px var(--color-red)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span className="monospace" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {new Date(incident.sla_started_at).toLocaleString()}
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-red)' }}>
                  CRITICAL ANOMALY ALARM DISPATCHED
                </span>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-primary)' }}>
                  Heuristics engine flagged {incident.anomaly_type} (score: {incident.score})
                </p>
              </div>
            </div>

            {/* Event 2: Tracking ticks */}
            {correlatedEvents.slice(0, 3).map((evt, idx) => (
              <div key={evt.event_id} style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '-25px', top: '2px', backgroundColor: 'var(--color-cyan)', width: '7px', height: '7px', borderRadius: '50%' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span className="monospace" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    {new Date(evt.timestamp).toLocaleString()}
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                    VECTOR TICK PATH UPDATE
                  </span>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Entity coordinate [X: {evt.payload.coordinates?.x}, Y: {evt.payload.coordinates?.y}] • Speed: {evt.payload.speed}px/s • Dwell: {evt.payload.dwell_time}s
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Triage Log Notes Persistence */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>OPERATOR ACTION LOGS & NOTES</h3>
          
          {/* Notes List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '180px', flex: 1 }}>
            {incident.operator_notes.map((note, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-cyan)' }}>
                    {note.operator}
                  </span>
                  <span className="monospace" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                    {new Date(note.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                  {note.text}
                </p>
              </div>
            ))}

            {incident.operator_notes.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                No operator notes filed on this ticket.
              </div>
            )}
          </div>

          {/* Note Input */}
          <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid var(--border-glass)', paddingTop: '14px' }}>
            <input
              type="text"
              placeholder="Add incident observations..."
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              className="ops-input"
              style={{ flex: 1, fontSize: '0.8rem' }}
            />
            <button
              onClick={() => handleTriageAction(incident.status, operatorName, noteInput)}
              disabled={isSaving || !noteInput.trim()}
              className="ops-btn ops-btn-primary"
              style={{ padding: '10px 16px' }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
export default IncidentDetail;
