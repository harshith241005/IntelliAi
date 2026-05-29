import React, { useMemo, useState } from 'react';
import { useStream } from '../context/StreamContext';
import { SeverityBadge } from '../components/SeverityBadge';

export const EventExplorer: React.FC = () => {
  const { events, cameras } = useStream();
  const [cameraFilter, setCameraFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const types = useMemo(() => [...new Set(events.map((e) => e.event_type))], [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (cameraFilter !== 'all' && e.camera_id !== cameraFilter) return false;
      if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
      if (typeFilter !== 'all' && e.event_type !== typeFilter) return false;
      return true;
    });
  }, [events, cameraFilter, severityFilter, typeFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <select
          value={cameraFilter}
          onChange={(e) => setCameraFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
        >
          <option value="all">All cameras</option>
          {cameras.map((c) => (
            <option key={c.camera_id} value={c.camera_id}>
              {c.camera_id}
            </option>
          ))}
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
        >
          <option value="all">All severity</option>
          <option value="info">Info</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
        >
          <option value="all">All event types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Camera</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Severity</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No events yet
                </td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr key={e.event_id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-cyan-300/90">
                    {e.event_type.replace(/_/g, ' ')}
                    {e.person_id != null && (
                      <span className="ml-2 text-slate-500">#{e.person_id}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{e.camera_id}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(e.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <SeverityBadge severity={e.severity} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
