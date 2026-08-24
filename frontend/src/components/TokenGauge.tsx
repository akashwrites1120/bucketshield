import React from 'react';

interface TokenGaugeProps {
  current: number;
  max: number;
  accent?: string;
}

function getStatus(pct: number): { color: string; label: string } {
  if (pct > 0.5) return { color: '#34d399', label: 'Healthy' };
  if (pct > 0.2) return { color: '#fbbf24', label: 'Low' };
  return { color: '#f87171', label: pct > 0 ? 'Critical' : 'Exhausted' };
}

export const TokenGauge: React.FC<TokenGaugeProps> = ({ current, max }) => {
  const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const { color, label } = getStatus(pct);

  return (
    <div className="flex flex-col items-center gap-3 w-full" style={{ width: 84 }}>
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
        Tokens
      </div>

      <div className="relative flex items-end justify-center" style={{ width: 56, height: 168 }}>
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
          }}
        >
          <div
            className="absolute bottom-0 left-0 right-0"
            style={{
              height: `${pct * 100}%`,
              background: color,
              opacity: 0.85,
              transition:
                'height 0.5s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.5s ease',
            }}
          />
        </div>

        {[0.25, 0.5, 0.75].map((t) => (
          <div
            key={t}
            className="absolute pointer-events-none"
            style={{
              bottom: `${t * 100}%`,
              left: 8,
              right: 8,
              height: 1,
              background: 'rgba(255,255,255,0.08)',
            }}
          />
        ))}
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <span
          key={Math.floor(current)}
          className="text-2xl font-semibold tabular-nums tracking-tight animate-pop-in"
          style={{ color }}
        >
          {current.toFixed(1)}
        </span>
        <span className="text-[11px] text-zinc-600">/ {max.toFixed(0)} tokens</span>
      </div>

      <div
        className="text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-[0.12em]"
        style={{
          background: `${color}14`,
          color,
          border: `1px solid ${color}2e`,
          transition: 'background 0.4s ease, color 0.4s ease',
        }}
      >
        {label}
      </div>
    </div>
  );
};
