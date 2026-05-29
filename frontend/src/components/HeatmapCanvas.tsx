import React, { useEffect, useRef } from 'react';
import { CCTVEvent } from '../types/schema';

interface HeatmapCanvasProps {
  events: CCTVEvent[];
  activeTracks: any[];
  width?: number;
  height?: number;
  cameraId?: string;
}

export const HeatmapCanvas: React.FC<HeatmapCanvasProps> = ({
  events,
  activeTracks,
  width = 400,
  height = 300,
  cameraId
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // HD scale support
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Draw floor schematic base layout
    ctx.clearRect(0, 0, width, height);

    // Background slate color
    ctx.fillStyle = '#161925';
    ctx.fillRect(0, 0, width, height);

    // Draw structural schematic grid borders
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridStep = 40;
    for (let x = 0; x < width; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 1. Draw defined zones
    const drawZone = (x: number, y: number, w: number, h: number, name: string, color: string, restricted: boolean = false) => {
      // Area box
      ctx.fillStyle = restricted ? 'rgba(255, 23, 68, 0.04)' : 'rgba(0, 229, 255, 0.02)';
      ctx.fillRect(x, y, w, h);

      // Area border dashed
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = restricted ? 'rgba(255, 23, 68, 0.25)' : 'rgba(0, 229, 255, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);

      // Label text
      ctx.fillStyle = restricted ? '#ff1744' : '#94a3b8';
      ctx.font = 'bold 8px Inter, system-ui';
      ctx.fillText(name.toUpperCase(), x + 6, y + 14);

      if (restricted) {
        ctx.fillStyle = 'rgba(255, 23, 68, 0.15)';
        ctx.font = '7px Inter';
        ctx.fillText("RESTRICTED AREA", x + 6, y + 23);
      }
    };

    if (cameraId === 'cam_104_04') {
      // Warehouse Camera Floor Plan
      drawZone(10, 10, width - 20, height - 20, "Warehouse Loading Dock", "#ff1744", true);
    } else if (cameraId === 'cam_208_02') {
      // Safe Camera Floor Plan
      drawZone(10, 10, width - 20, height - 20, "Secured Counter & Safe", "#ff1744", true);
    } else {
      // Main Standard Store Floor Plan
      // Entrance: [0-30, 0-35] => pixel: [x:0 to 120, y:0 to 105]
      drawZone(10, 10, 110, 95, "Entrance Vestibule", "#00e5ff");
      
      // Electronics: [30-70, 10-60] => pixel: [x:120 to 280, y:30 to 180]
      drawZone(130, 10, 140, 120, "Electronics Section", "#00e5ff");
      
      // Restricted Warehouse: [70-100, 70-100] => pixel: [x:280 to 400, y:210 to 300]
      drawZone(280, 190, 110, 100, "Loading Dock corridor", "#ff1744", true);
      
      // Checkout: [30-70, 65-100] => pixel: [x:120 to 280, y:195 to 300]
      drawZone(130, 140, 140, 150, "Checkout Lanes A-C", "#00e5ff");
    }

    // 2. Draw historical track paths in the background
    activeTracks.forEach(track => {
      if (!track.path || track.path.length < 2) return;

      ctx.beginPath();
      const startX = (track.path[0].x / 100) * width;
      const startY = (track.path[0].y / 100) * height;
      ctx.moveTo(startX, startY);

      track.path.forEach((pt: { x: number; y: number }) => {
        const px = (pt.x / 100) * width;
        const py = (pt.y / 100) * height;
        ctx.lineTo(px, py);
      });

      const isRestricted = track.zone_id.includes('restricted');
      ctx.strokeStyle = isRestricted ? 'rgba(255, 23, 68, 0.2)' : 'rgba(0, 229, 255, 0.15)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    });

    // 3. Draw active track positions with coordinate scaling and glowing dots
    activeTracks.forEach(track => {
      const px = (track.x / 100) * width;
      const py = (track.y / 100) * height;
      const isRestricted = track.zone_id.includes('restricted');

      // Outer fading heat circle
      ctx.beginPath();
      ctx.arc(px, py, track.is_stationary ? 14 : 8, 0, 2 * Math.PI);
      ctx.fillStyle = isRestricted 
        ? 'rgba(255, 23, 68, 0.12)' 
        : track.is_stationary 
          ? 'rgba(255, 145, 0, 0.1)' 
          : 'rgba(0, 229, 255, 0.08)';
      ctx.fill();

      // Inner tracking dot
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, 2 * Math.PI);
      ctx.fillStyle = isRestricted 
        ? '#ff1744' 
        : track.is_stationary 
          ? '#ff9100' 
          : '#00e5ff';
      ctx.fill();

      // Track tag ID text
      ctx.fillStyle = '#f8fafc';
      ctx.font = '9px monospace';
      ctx.fillText(
        `${track.track_id.split('_')[1] || track.track_id} [${track.label}]`,
        px + 8,
        py + 3
      );
    });

  }, [events, activeTracks, width, height, cameraId]);

  return (
    <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
      <canvas ref={canvasRef} />
      
      {/* Live tracking overlay sticker */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: 'rgba(15, 17, 26, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--border-glass)',
          borderRadius: '6px',
          padding: '4px 8px',
          fontSize: '0.65rem',
          fontWeight: 600,
          color: 'var(--text-secondary)'
        }}
      >
        <span className="pulse-dot-green" style={{ width: '6px', height: '6px' }} />
        <span>LIVE VECTOR TRACKS</span>
      </div>
    </div>
  );
};
export default HeatmapCanvas;
