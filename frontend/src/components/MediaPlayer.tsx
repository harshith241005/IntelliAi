import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, Layers, Eye, EyeOff } from 'lucide-react';

interface MediaPlayerProps {
  cameraId: string;
  cameraName: string;
  activeTracks: any[];
}

const STREAM_POSTERS: { [key: string]: string } = {
  cam_104_01: "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=800&auto=format&fit=crop", // Entrance
  cam_104_02: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?q=80&w=800&auto=format&fit=crop", // Checkout
  cam_104_03: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?q=80&w=800&auto=format&fit=crop", // Electronics
  cam_104_04: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=800&auto=format&fit=crop", // Warehouse Loading
  cam_208_01: "https://images.unsplash.com/photo-1555529669-e69e7aa0db9a?q=80&w=800&auto=format&fit=crop", // Entrance 2
  cam_208_02: "https://images.unsplash.com/photo-1563013544-824ae1d704d3?q=80&w=800&auto=format&fit=crop", // Safe Counter
};

export const MediaPlayer: React.FC<MediaPlayerProps> = ({
  cameraId,
  cameraName,
  activeTracks
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [fps, setFps] = useState(30);

  // Slightly jitter FPS for realism
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setFps(Math.round(28.8 + Math.random() * 2.4));
    }, 1500);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const posterUrl = STREAM_POSTERS[cameraId] || STREAM_POSTERS.cam_104_01;

  return (
    <div
      style={{
        backgroundColor: '#000',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid var(--border-glass)',
        position: 'relative',
        width: '100%',
        paddingBottom: '56.25%', // 16:9 Aspect Ratio
        userSelect: 'none'
      }}
    >
      {/* 1. CCTV Video Frame Image */}
      <img
        src={posterUrl}
        alt={cameraName}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: isPlaying ? 0.8 : 0.3,
          transition: 'opacity 300ms ease',
          filter: 'grayscale(15%) contrast(110%) brightness(95%)'
        }}
      />

      {/* Camera Scanline overlay effects */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03))',
          backgroundSize: '100% 4px, 6px 100%'
        }}
      />

      {/* 2. Real-Time Dynamic Bounding Boxes overlays */}
      {isPlaying && showBoundingBoxes && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
          {activeTracks
            .filter(t => t.camera_id === cameraId)
            .map(track => {
              // Convert 0-100 coordinates to percentage styles
              const left = `${track.x}%`;
              const top = `${track.y}%`;
              const width = `${track.width || 20}%`;
              const height = `${track.height || 40}%`;

              const isRestricted = track.zone_id.includes('restricted');
              const borderColor = isRestricted 
                ? 'var(--color-red)' 
                : track.is_stationary 
                  ? 'var(--color-amber)' 
                  : 'var(--color-cyan)';

              return (
                <div
                  key={track.track_id}
                  style={{
                    position: 'absolute',
                    left,
                    top,
                    width,
                    height,
                    border: `1.5px solid ${borderColor}`,
                    boxShadow: `0 0 8px ${borderColor}44`,
                    transform: 'translate(-50%, -50%)',
                    transition: 'left 1s linear, top 1s linear', // smooth tracking paths
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start'
                  }}
                >
                  {/* Tracking Label Tag */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '-15px',
                      left: '-1.5px',
                      backgroundColor: borderColor,
                      color: '#0f111a',
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      padding: '1px 4px',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}
                  >
                    <span>{track.track_id.split('_')[1]}</span>
                    <span>{track.label.toUpperCase()}</span>
                    <span>{(track.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* 3. Top Info Overlay Strip */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          right: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'none'
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(15, 17, 26, 0.8)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border-glass)',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '0.7rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span className={isPlaying ? "pulse-dot-green" : "pulse-dot-red"} style={{ width: '6px', height: '6px' }} />
          <span>{cameraName.toUpperCase()}</span>
        </div>

        <div
          className="monospace"
          style={{
            backgroundColor: 'rgba(15, 17, 26, 0.8)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border-glass)',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '0.7rem',
            color: 'var(--text-secondary)'
          }}
        >
          {isPlaying ? `${fps} FPS` : 'PAUSED'} | 1080P
        </div>
      </div>

      {/* 4. Bottom Interactive Controls Overlay Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          right: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10
        }}
      >
        {/* Playback actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              backgroundColor: 'rgba(15, 17, 26, 0.85)',
              border: '1px solid var(--border-glass)',
              borderRadius: '6px',
              padding: '6px 10px',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 150ms'
            }}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>

          <button
            onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
            style={{
              backgroundColor: showBoundingBoxes ? 'rgba(0, 229, 255, 0.2)' : 'rgba(15, 17, 26, 0.85)',
              border: `1px solid ${showBoundingBoxes ? 'var(--color-cyan)' : 'var(--border-glass)'}`,
              borderRadius: '6px',
              padding: '6px 10px',
              color: showBoundingBoxes ? 'var(--color-cyan)' : '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.7rem',
              fontWeight: 600,
              transition: 'all 150ms'
            }}
          >
            {showBoundingBoxes ? <Eye size={14} /> : <EyeOff size={14} />}
            <span>BOXES</span>
          </button>
        </div>

        {/* Timestamp */}
        <div
          className="monospace"
          style={{
            backgroundColor: 'rgba(15, 17, 26, 0.85)',
            border: '1px solid var(--border-glass)',
            borderRadius: '6px',
            padding: '5px 10px',
            fontSize: '0.65rem',
            color: 'var(--text-primary)'
          }}
        >
          {new Date().toISOString().split('T')[1].substr(0, 8)}
        </div>
      </div>
    </div>
  );
};
export default MediaPlayer;
