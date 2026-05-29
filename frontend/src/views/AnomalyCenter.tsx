import React, { useEffect, useState } from 'react';
import { useStream } from '../context/StreamContext';
import { SeverityBadge } from '../components/SeverityBadge';
import type { Alert } from '../types/schema';

export const AnomalyCenter: React.FC = () => {
  const { silenceAlert, investigateAlert } = useStream();
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    fetch('/api/alerts')
      .then((r) => r.json())
      .then(setAlerts)
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Active alerts from crowd detection, zone breaches, and high occupancy rules.
      </p>
      <div className="grid gap-3">
        {alerts.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-slate-500">
            No active alerts
          </p>
        ) : (
          alerts.map((a) => (
            <div
              key={a.alert_id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <div>
                <p className="font-semibold">{a.type.replace(/_/g, ' ')}</p>
                <p className="text-sm text-slate-400">{a.message}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {a.camera_id} • {new Date(a.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <SeverityBadge severity={a.severity} />
                <span className="text-xs uppercase text-slate-500">{a.status}</span>
                <button
                  type="button"
                  onClick={() => silenceAlert(a.alert_id)}
                  className="rounded border border-white/20 px-3 py-1 text-xs"
                >
                  Silence
                </button>
                <button
                  type="button"
                  onClick={() => investigateAlert(a.alert_id)}
                  className="rounded bg-cyan-600 px-3 py-1 text-xs text-white"
                >
                  Investigate
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
