import React from 'react';

interface SeverityBadgeProps {
  severity: string;
}

const styles: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  info: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
};

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity }) => {
  const key = severity?.toLowerCase() || 'info';
  return (
    <span
      className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${styles[key] ?? styles.info}`}
    >
      {key}
    </span>
  );
};
