import React from 'react';
import { LucideIcon } from 'lucide-react';
import { LatencySparkline } from './LatencySparkline';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtext?: string;
  sparklineData?: number[];
  color?: 'cyan' | 'red' | 'amber' | 'green';
  glow?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  subtext,
  sparklineData,
  color = 'cyan',
  glow = true
}) => {
  const getColorHex = () => {
    switch (color) {
      case 'red': return '#ff1744';
      case 'amber': return '#ff9100';
      case 'green': return '#00e676';
      case 'cyan':
      default:
        return '#00e5ff';
    }
  };

  const colorHex = getColorHex();

  return (
    <div
      className={`glass-panel ${glow ? `card-glow-${color}` : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '12px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Decorative Top Accent Border Line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: `linear-gradient(90deg, ${colorHex}88 0%, transparent 80%)`
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {title}
          </span>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '4px', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </div>
        </div>

        <div
          style={{
            backgroundColor: `${colorHex}15`,
            color: colorHex,
            border: `1px solid ${colorHex}2a`,
            borderRadius: '10px',
            padding: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Icon size={20} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '36px' }}>
        {subtext && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {subtext}
          </span>
        )}

        {sparklineData && sparklineData.length > 1 && (
          <div style={{ marginLeft: 'auto' }}>
            <LatencySparkline data={sparklineData} color={colorHex} />
          </div>
        )}
      </div>
    </div>
  );
};
export default StatCard;
