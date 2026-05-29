import React, { useEffect, useState } from 'react';
import type { SystemMetrics } from '../types/schema';

export const SystemHealth: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);

  useEffect(() => {
    const load = () => {
      fetch('/api/dashboard/metrics')
        .then((r) => r.json())
        .then(setMetrics)
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, []);

  const cards = [
    { label: 'FPS', value: metrics?.fps ?? '—' },
    { label: 'AI processing time', value: metrics ? `${metrics.ai_processing_ms} ms` : '—' },
    { label: 'Queue size', value: metrics?.queue_size ?? '—' },
    { label: 'API latency', value: metrics ? `${metrics.api_latency_ms} ms` : '—' },
    { label: 'Active streams', value: metrics?.active_streams ?? '—' },
    { label: 'Events ingested', value: metrics?.events_ingested_total ?? '—' },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-white/10 bg-white/5 p-5"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {c.label}
          </p>
          <p className="mt-2 text-2xl font-bold text-cyan-400">{c.value}</p>
        </div>
      ))}
    </div>
  );
};
