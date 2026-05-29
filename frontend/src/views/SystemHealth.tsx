import React, { useState, useEffect } from 'react';
import { useStream } from '../context/StreamContext';
import { StatCard } from '../components/StatCard';
import { SeverityBadge } from '../components/SeverityBadge';
import { Cpu, Terminal, ArrowRight, ShieldCheck, Activity, Layers } from 'lucide-react';
import { SystemHealthMetrics } from '../types/schema';

export const SystemHealth: React.FC = () => {
  const { connectionStatus } = useStream();
  const [metrics, setMetrics] = useState<SystemHealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch telemetry logs & API health from backend REST APIs
  const fetchHealthMetrics = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/system/health');
      if (res.ok) {
        const json = await res.json();
        setMetrics(json);
      }
    } catch (e) {
      console.error("Failed to fetch API health metrics:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHealthMetrics();
    const interval = setInterval(() => {
      fetchHealthMetrics();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !metrics) {
    return (
      <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Interrogating pipeline node systems health...
      </div>
    );
  }

  const recentLogs = metrics ? metrics.logs : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 1. Endpoint performance cards */}
      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <StatCard
            title="REST API p95 Latency"
            value={`${metrics.api_p95_latency_ms} ms`}
            icon={Cpu}
            subtext="Endpoint execution delay"
            color={metrics.api_p95_latency_ms > 50 ? 'amber' : 'green'}
            glow={false}
          />
          <StatCard
            title="Throughput (Processed)"
            value={`${metrics.events_processed_per_min} / min`}
            icon={Activity}
            subtext="Pipeline enrichment throughput"
            color="cyan"
            glow={false}
          />
          <StatCard
            title="Active WS Subscriptions"
            value={`${metrics.active_ws_connections} client`}
            icon={Layers}
            subtext="Active client socket streams"
            color="green"
            glow={false}
          />
          <StatCard
            title="Queue Ingestion Lag"
            value={`${metrics.ingestion_lag_ms} ms`}
            icon={Activity}
            subtext="Ingest -> Detect telemetry"
            color="green"
            glow={false}
          />
        </div>
      )}

      {/* 2. Pipeline processing stages pipeline block */}
      {metrics && (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>PIPELINE STAGE PROCESSING FLOW</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <span>Schema Version:</span>
              <span className="monospace" style={{ backgroundColor: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px', color: '#fff', fontWeight: 600 }}>
                v{metrics.schema_version}
              </span>
            </div>
          </div>

          {/* Visual Step blocks */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            
            {/* Step 1: Ingest */}
            <div
              style={{
                flex: 1,
                minWidth: '130px',
                backgroundColor: metrics.features_flags.ingest ? 'rgba(0, 230, 118, 0.08)' : 'var(--bg-tertiary)',
                border: `1.5px solid ${metrics.features_flags.ingest ? 'var(--color-green)' : 'var(--border-glass)'}`,
                borderRadius: '8px',
                padding: '12px 14px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: metrics.features_flags.ingest ? '#fff' : 'var(--text-secondary)' }}>INGESTION</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>30 FPS frame grab</span>
            </div>

            <ArrowRight size={14} color="var(--text-muted)" />

            {/* Step 2: Detect */}
            <div
              style={{
                flex: 1,
                minWidth: '130px',
                backgroundColor: metrics.features_flags.detect ? 'rgba(0, 230, 118, 0.08)' : 'var(--bg-tertiary)',
                border: `1.5px solid ${metrics.features_flags.detect ? 'var(--color-green)' : 'var(--border-glass)'}`,
                borderRadius: '8px',
                padding: '12px 14px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: metrics.features_flags.detect ? '#fff' : 'var(--text-secondary)' }}>DETECTION</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>YOLOv8 coordinates</span>
            </div>

            <ArrowRight size={14} color="var(--text-muted)" />

            {/* Step 3: Track */}
            <div
              style={{
                flex: 1,
                minWidth: '130px',
                backgroundColor: metrics.features_flags.track ? 'rgba(0, 230, 118, 0.08)' : 'var(--bg-tertiary)',
                border: `1.5px solid ${metrics.features_flags.track ? 'var(--color-green)' : 'var(--border-glass)'}`,
                borderRadius: '8px',
                padding: '12px 14px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: metrics.features_flags.track ? '#fff' : 'var(--text-secondary)' }}>TRACKING</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Stateful vector IDs</span>
            </div>

            <ArrowRight size={14} color="var(--text-muted)" />

            {/* Step 4: Enrich */}
            <div
              style={{
                flex: 1,
                minWidth: '130px',
                backgroundColor: metrics.features_flags.enrich ? 'rgba(0, 230, 118, 0.08)' : 'var(--bg-tertiary)',
                border: `1.5px solid ${metrics.features_flags.enrich ? 'var(--color-green)' : 'var(--border-glass)'}`,
                borderRadius: '8px',
                padding: '12px 14px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: metrics.features_flags.enrich ? '#fff' : 'var(--text-secondary)' }}>HEURISTICS ENRICH</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Anomaly detection</span>
            </div>

            <ArrowRight size={14} color="var(--text-muted)" />

            {/* Step 5: Publish */}
            <div
              style={{
                flex: 1,
                minWidth: '130px',
                backgroundColor: metrics.features_flags.publish ? 'rgba(0, 230, 118, 0.08)' : 'var(--bg-tertiary)',
                border: `1.5px solid ${metrics.features_flags.publish ? 'var(--color-green)' : 'var(--border-glass)'}`,
                borderRadius: '8px',
                padding: '12px 14px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: metrics.features_flags.publish ? '#fff' : 'var(--text-secondary)' }}>BROADCAST WS</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Reactive operations</span>
            </div>

          </div>
        </div>
      )}

      {/* 3. Recent 4xx/5xx log tails */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={16} color="var(--color-cyan)" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>PIPELINE DIAGNOSTICS TAIL LOGS (RECENT 10)</h3>
        </div>

        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-glass)', backgroundColor: '#0b0c10' }}>
          <table className="ops-table">
            <thead>
              <tr>
                <th>TIMESTAMP</th>
                <th>LEVEL</th>
                <th>API / PIPELINE STAGE</th>
                <th>CODE</th>
                <th>MESSAGE</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.map((log, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td className="monospace" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: log.level === 'error' ? 'var(--color-red)' : log.level === 'warning' ? 'var(--color-amber)' : 'var(--color-cyan)'
                      }}
                    >
                      {log.level}
                    </span>
                  </td>
                  <td className="monospace" style={{ fontSize: '0.8rem', color: 'var(--color-cyan)' }}>
                    {log.endpoint}
                  </td>
                  <td className="monospace" style={{ fontSize: '0.8rem' }}>
                    {log.status}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-primary)', whiteSpace: 'normal', wordBreak: 'break-all' }}>
                    {log.message}
                  </td>
                </tr>
              ))}

              {recentLogs.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                    Diagnostics tail logs clear. Hardware pipelines fully nominal.
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
export default SystemHealth;
