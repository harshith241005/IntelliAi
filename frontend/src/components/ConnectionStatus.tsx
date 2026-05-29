import React from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useStream } from '../context/StreamContext';

export const ConnectionStatus: React.FC = () => {
  const { connectionStatus } = useStream();

  const config =
    connectionStatus === 'connected'
      ? { text: 'Socket.IO live', className: 'border-green-500/30 bg-green-500/10 text-green-400', icon: <Wifi size={12} /> }
      : connectionStatus === 'connecting'
        ? { text: 'Connecting…', className: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400', icon: <RefreshCw size={12} className="animate-spin" /> }
        : { text: 'Disconnected', className: 'border-red-500/30 bg-red-500/10 text-red-400', icon: <WifiOff size={12} /> };

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${config.className}`}
    >
      {config.icon}
      <span>{config.text}</span>
    </div>
  );
};
