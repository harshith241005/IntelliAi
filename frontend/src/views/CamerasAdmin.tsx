import React from 'react';
import { useStream } from '../context/StreamContext';

export const CamerasAdmin: React.FC = () => {
  const { cameras, refreshCameras } = useStream();

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="text-sm text-slate-400">
          Register and monitor CCTV sources (webcam, video file, or simulated feeds).
        </p>
        <button
          type="button"
          onClick={() => refreshCameras()}
          className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-400"
        >
          Refresh
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {cameras.map((cam) => (
          <div
            key={cam.camera_id}
            className="rounded-xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-5"
          >
            <div className="mb-3 flex aspect-video items-center justify-center rounded-lg bg-black/40 text-slate-600">
              LIVE FEED — {cam.camera_id}
            </div>
            <h4 className="font-bold">{cam.name}</h4>
            <p className="text-xs text-slate-500">{cam.source || 'default'}</p>
            <span
              className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${
                cam.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/30'
              }`}
            >
              {cam.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
