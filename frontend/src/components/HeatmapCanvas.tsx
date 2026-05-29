import React, { useEffect, useRef } from 'react';
import type { StoreEvent } from '../types/schema';

interface HeatmapCanvasProps {
  events: StoreEvent[];
  width?: number;
  height?: number;
}

export const HeatmapCanvas: React.FC<HeatmapCanvasProps> = ({
  events,
  width = 360,
  height = 220,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;
    ctx.fillStyle = '#161925';
    ctx.fillRect(0, 0, width, height);

    const zones = [
      { label: 'Entrance', x: 10, y: 10, w: 100, h: 80 },
      { label: 'Aisle 1', x: 120, y: 10, w: 110, h: 100 },
      { label: 'Billing', x: 240, y: 10, w: 110, h: 100 },
      { label: 'Restricted', x: 200, y: 120, w: 150, h: 90, restricted: true },
    ];

    zones.forEach((z) => {
      ctx.fillStyle = z.restricted ? 'rgba(255,23,68,0.08)' : 'rgba(0,229,255,0.05)';
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = z.restricted ? 'rgba(255,23,68,0.4)' : 'rgba(0,229,255,0.2)';
      ctx.strokeRect(z.x, z.y, z.w, z.h);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText(z.label, z.x + 6, z.y + 14);
    });

    events.forEach((e) => {
      if (!e.coordinates) return;
      const px = Math.min(width - 4, Math.max(4, e.coordinates.x * 0.6));
      const py = Math.min(height - 4, Math.max(4, e.coordinates.y * 0.5));
      const g = ctx.createRadialGradient(px, py, 0, px, py, 18);
      g.addColorStop(0, 'rgba(0,229,255,0.7)');
      g.addColorStop(1, 'rgba(0,229,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, 18, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [events, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-lg border border-white/10"
      style={{ maxWidth: width, height }}
    />
  );
};
