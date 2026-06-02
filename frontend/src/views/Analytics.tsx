import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { HeatmapZone } from '../types/schema';

export const Analytics: React.FC = () => {
  const [heatmap, setHeatmap] = useState<HeatmapZone[]>([]);

  useEffect(() => {
    fetch('/api/dashboard/heatmap')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setHeatmap(data);
        } else if (data && Array.isArray(data.heatmap)) {
          setHeatmap(data.heatmap);
        }
      })
      .catch(() => {});
  }, []);


  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-300">Zone density heatmap</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={heatmap}>
              <XAxis dataKey="zone" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: '#161925',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              />
              <Bar dataKey="density" fill="#00e5ff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {heatmap.map((z) => (
            <li
              key={z.zone}
              className="flex justify-between rounded-lg bg-black/20 px-3 py-2 text-sm"
            >
              <span>{z.zone}</span>
              <span
                className={
                  z.level === 'high'
                    ? 'text-red-400'
                    : z.level === 'medium'
                      ? 'text-amber-400'
                      : 'text-slate-400'
                }
              >
                {z.level === 'high' ? 'crowded' : z.level}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
