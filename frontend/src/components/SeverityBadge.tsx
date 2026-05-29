import React from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface SeverityBadgeProps {
  severity: 'info' | 'warning' | 'critical';
  size?: 'sm' | 'md';
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, size = 'md' }) => {
  const getStyles = () => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'rgba(255, 23, 68, 0.12)',
          color: '#ff1744',
          border: 'rgba(255, 23, 68, 0.25)',
          icon: <AlertCircle className="severity-icon" size={size === 'sm' ? 12 : 14} />
        };
      case 'warning':
        return {
          bg: 'rgba(255, 145, 0, 0.12)',
          color: '#ff9100',
          border: 'rgba(255, 145, 0, 0.25)',
          icon: <AlertTriangle className="severity-icon" size={size === 'sm' ? 12 : 14} />
        };
      case 'info':
      default:
        return {
          bg: 'rgba(0, 229, 255, 0.12)',
          color: '#00e5ff',
          border: 'rgba(0, 229, 255, 0.25)',
          icon: <Info className="severity-icon" size={size === 'sm' ? 12 : 14} />
        };
    }
  };

  const styles = getStyles();

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: styles.bg,
        color: styles.color,
        border: `1px solid ${styles.border}`,
        borderRadius: '6px',
        padding: size === 'sm' ? '2px 6px' : '4px 10px',
        fontSize: size === 'sm' ? '0.7rem' : '0.75rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}
    >
      {styles.icon}
      {severity}
    </span>
  );
};
export default SeverityBadge;
