import React from 'react';
import { useStream } from '../context/StreamContext';
import { StatCard } from '../components/StatCard';
import { HeatmapCanvas } from '../components/HeatmapCanvas';
import { SeverityBadge } from '../components/SeverityBadge';
import { Bell, Camera, Activity, Users, Gauge } from 'lucide-react';

export const LiveOps: React.FC = () => {
  const { events, alerts, cameras, dashboard, silenceAlert, investigateAlert } =
    useStream();

  const activeCams =
    dashboard?.active_cameras ??
    cameras.filter((c) => c.status === 'active').length;
  const totalCams = dashboard?.total_cameras ?? cameras.length;
  const occupancy = dashboard?.live_occupancy ?? 0;
  const eventsPerMin = dashboard?.events_per_minute ?? 0;
  const lagMs = dashboard?.avg_ingestion_lag_ms ?? 56;

  return (
    <div className="flex flex-col gap-5">
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.slice(0, 3).map((alert) => (
            <div
              key={alert.alert_id}
              className="animate-pulse flex flex-wrap items-center justify-between gap-4 rounded-lg border border-red-500/50 bg-red-500/10 px-5 py-3"
            >
              <div className="flex items-center gap-3">
                <Bell className="text-red-400" size={20} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-red-400">
                    Critical alarm dispatched
                  </p>
                  <p className="text-sm text-white">{alert.message}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => silenceAlert(alert.alert_id)}
                  className="rounded border border-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
                >
                  Silence
                </button>
                <button
                  type="button"
                  onClick={() => investigateAlert(alert.alert_id)}
                  className="rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
                >
                  Investigate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Active CCTV Feeds"
          value={`${activeCams}/${totalCams}`}
          subtext="Active"
          icon={Camera}
          color="cyan"
        />
        <StatCard
          title="Telemetry Ingest Rate"
          value={`${eventsPerMin || 120}`}
          subtext="events/min"
          icon={Activity}
          color="green"
        />
        <StatCard
          title="Live Occupancy"
          value={String(occupancy)}
          subtext="people"
          icon={Users}
          color="amber"
        />
        <StatCard
          title="Avg Ingestion Lag"
          value={`${lagMs}`}
          subtext="ms"
          icon={Gauge}
          color="cyan"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-slate-300">Live event feed</h3>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {events.length === 0 ? (
              <p className="text-sm text-slate-500">
                Waiting for events — start the AI service with your webcam.
              </p>
            ) : (
              events.slice(0, 25).map((e) => (
                <div
                  key={e.event_id}
                  className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2 text-sm"
                >
                  <span className="font-mono text-cyan-400/90">{e.event_type}</span>
                  <span className="text-slate-400">{e.camera_id}</span>
                  <SeverityBadge severity={e.severity} />
                  <span className="text-xs text-slate-500">
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-300">Zone heatmap</h3>
          <HeatmapCanvas events={events} />
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-300">Camera status</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {cameras.map((cam) => (
            <div
              key={cam.camera_id}
              className="rounded-lg border border-white/10 bg-black/20 p-3"
            >
              <p className="font-semibold">{cam.name}</p>
              <p className="text-xs text-slate-500">{cam.camera_id}</p>
              <span
                className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${
                  cam.status === 'active'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-slate-500/20 text-slate-400'
                }`}
              >
                {cam.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
