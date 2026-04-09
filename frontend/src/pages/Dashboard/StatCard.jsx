import React from 'react';

export default function StatCard({ label, value, color, icon, sub }) {
  return (
    <div
      className="card card-hover animate-count-up"
      style={{ padding: '20px 22px', position: 'relative', overflow: 'hidden' }}
    >
      {/* Subtle gradient accent */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 80, height: 80,
        background: color ? `${color}10` : 'var(--accent-dim)',
        borderRadius: '0 16px 0 80px',
        pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            {label}
          </p>
          <p style={{ fontSize: '2rem', fontWeight: 700, color: color || 'var(--text)', lineHeight: 1, letterSpacing: '-0.03em' }}>
            {value.toLocaleString('pt-BR')}
          </p>
          {sub && <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 4 }}>{sub}</p>}
        </div>
        {icon && (
          <div style={{
            width: 36, height: 36,
            borderRadius: 10,
            background: color ? `${color}15` : 'var(--surface-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: color || 'var(--text-2)',
            flexShrink: 0,
          }}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
