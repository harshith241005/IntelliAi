import React, { useState, useEffect } from 'react';
import { useStream } from '../context/StreamContext';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, LineChart, Line
} from 'recharts';
import { Calendar, Download, RefreshCw, BarChart3, LineChart as LineIcon } from 'lucide-react';

interface AnalyticsProps {
  selectedStoreId: string | null;
}

export const Analytics: React.FC<AnalyticsProps> = ({ selectedStoreId }) => {
  const [range, setRange] = useState('24h');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fetch analytical data from backend router REST endpoints
  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3001/api/analytics?range=${range}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error("Failed to fetch analytics payload:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAnalytics();
  }, [range]);

  const exportData = () => {
    if (!data) return;
    const items = data.footfall;
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Timestamp,Metrotown Flagship,Downtown Express,Total Fleet\n";
    items.forEach((item: any) => {
      csvContent += `"${item.timestamp}",${item["Metrotown Flagship"]},${item["Downtown Express"]},${item["Total Fleet"]}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `store_analytics_${range}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (loading && !data) {
    return (
      <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Rendering analytical aggregates...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 1. Filter Presets & Export Actions Bar */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Calendar size={16} color="var(--color-cyan)" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>HISTORICAL TIMERANGE</span>
          
          <div style={{ display: 'flex', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '2px' }}>
            {['1h', '24h', '7d', '30d'].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  background: range === r ? 'var(--bg-glass)' : 'transparent',
                  border: 'none',
                  color: range === r ? 'var(--color-cyan)' : 'var(--text-secondary)',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={fetchAnalytics} className="ops-btn ops-btn-secondary" style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
            <RefreshCw size={12} /> SYNC DATA
          </button>
          <button onClick={exportData} className="ops-btn ops-btn-primary" style={{ padding: '8px 14px', fontSize: '0.8rem' }}>
            <Download size={12} /> EXPORT ANALYTICS
          </button>
        </div>
      </div>

      {/* 2. Analytical Graphs grid */}
      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Row 1: Footfall unique tracks */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={16} color="var(--color-cyan)" />
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>STORE FOOTFALL / UNIQUE TRACKS</h3>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Unique coordinates tracks computed E2E
              </span>
            </div>

            <div style={{ width: '100%', height: '240px', fontSize: '0.75rem' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.footfall} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="color104" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-cyan)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="var(--color-cyan)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="color208" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-amber)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="var(--color-amber)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="timestamp" stroke="var(--text-secondary)" />
                  <YAxis stroke="var(--text-secondary)" />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '8px' }} />
                  <Legend />
                  <Area type="monotone" dataKey="Metrotown Flagship" stroke="var(--color-cyan)" fillOpacity={1} fill="url(#color104)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Downtown Express" stroke="var(--color-amber)" fillOpacity={1} fill="url(#color208)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 2: Latency percentiles & Anomaly comparisons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flexWrap: 'wrap' }}>
            
            {/* Pipeline Ingestion latency */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <LineIcon size={16} color="var(--color-cyan)" />
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>PIPELINE LATENCY PERCENTILES (p50/p95/p99)</h3>
              </div>

              <div style={{ width: '100%', height: '200px', fontSize: '0.75rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.latency} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="timestamp" stroke="var(--text-secondary)" />
                    <YAxis stroke="var(--text-secondary)" />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }} />
                    <Legend />
                    <Line type="monotone" dataKey="p50" stroke="var(--color-green)" dot={false} strokeWidth={1.5} />
                    <Line type="monotone" dataKey="p95" stroke="var(--color-amber)" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="p99" stroke="var(--color-red)" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Dwell distribution */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>AVERAGE ZONE DWELL TIME DISTRIBUTION</h3>

              <div style={{ width: '100%', height: '200px', fontSize: '0.75rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.dwell} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" />
                    <YAxis stroke="var(--text-secondary)" />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }} />
                    <Legend />
                    <Bar dataKey="average_dwell_sec" name="Avg dwell (s)" fill="var(--color-cyan)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="p95_dwell_sec" name="p95 dwell (s)" fill="rgba(0, 229, 255, 0.3)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Row 3: Anomaly comparison rate by Store */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>ANOMALY TRIGGER COUNTS COMPARISON</h3>
            
            <div style={{ width: '100%', height: '220px', fontSize: '0.75rem' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.anomalies} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="var(--text-secondary)" />
                  <YAxis stroke="var(--text-secondary)" />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }} />
                  <Legend />
                  <Bar dataKey="Metrotown Flagship" fill="var(--color-cyan)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Downtown Express" fill="var(--color-amber)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
export default Analytics;
