import React from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useStream } from '../context/StreamContext';

export const ConnectionStatus: React.FC = () => {
  const { connectionStatus, isStale } = useStream();

  const getStatusConfig = () => {
    if (isStale && connectionStatus === 'connected') {
      return {
        bg: 'rgba(255, 145, 0, 0.12)',
        color: '#ff9100',
        border: 'rgba(255, 145, 0, 0.25)',
        text: 'STALE DATA',
        icon: <RefreshCw size={12} className="spin-reconnect" />
      };
    }

    switch (connectionStatus) {
      case 'connected':
        return {
          bg: 'rgba(0, 230, 118, 0.12)',
          color: '#00e676',
          border: 'rgba(0, 230, 118, 0.25)',
          text: 'STREAM ACTIVE',
          icon: <Wifi size={12} />
        };
      case 'connecting':
        return {
          bg: 'rgba(0, 229, 255, 0.12)',
          color: '#00e5ff',
          border: 'rgba(0, 229, 255, 0.25)',
          text: 'CONNECTING',
          icon: <RefreshCw size={12} className="spin-reconnect" />
        };
      case 'disconnected':
      default:
        return {
          bg: 'rgba(255, 23, 68, 0.12)',
          color: '#ff1744',
          border: 'rgba(255, 23, 68, 0.25)',
          text: 'DISCONNECTED',
          icon: <WifiOff size={12} />
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        borderRadius: '20px',
        padding: '4px 12px',
        fontSize: '0.7rem',
        fontWeight: 700,
        letterSpacing: '0.05em',
        transition: 'all 200ms'
      }}
    >
      {config.icon}
      <span>{config.text}</span>

      {/* Embedded CSS animation for spins */}
      <style>{`
        @keyframes spinReconnect {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-reconnect {
          animation: spinReconnect 1.5s linear infinite;
        }
      `}</style>
    </div>
  );
};
export default ConnectionStatus;
