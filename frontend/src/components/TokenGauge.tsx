import React, { useEffect, useRef } from 'react';

interface TokenGaugeProps {
  current: number;
  max: number;
}

function getColor(pct: number): { fill: string; glow: string; track: string } {
  if (pct > 0.5) return { fill: '#22c55e', glow: 'rgba(34,197,94,0.35)', track: 'rgba(34,197,94,0.1)' };
  if (pct > 0.2) return { fill: '#f59e0b', glow: 'rgba(245,158,11,0.35)', track: 'rgba(245,158,11,0.1)' };
  return { fill: '#ef4444', glow: 'rgba(239,68,68,0.35)', track: 'rgba(239,68,68,0.1)' };
}

/**
 * Animated vertical token-bucket gauge.
 * Uses a CSS transition on the fill height for smooth drain/refill visuals.
 */
export const TokenGauge: React.FC<TokenGaugeProps> = ({ current, max }) => {
  const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const { fill, glow, track } = getColor(pct);
  const prevPct = useRef(pct);

  useEffect(() => {
    prevPct.current = pct;
  }, [pct]);

  const fillHeight = `${pct * 100}%`;

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Label */}
      <div className="text-xs font-semibold tracking-widest uppercase text-slate-400">
        Token Level
      </div>

      {/* Gauge container */}
      <div className="relative flex items-end justify-center" style={{ width: 72, height: 180 }}>
        {/* Track background */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {/* Animated fill */}
          <div
            className="absolute bottom-0 left-0 right-0 rounded-2xl"
            style={{
              height: fillHeight,
              background: `linear-gradient(to top, ${fill}, ${fill}cc)`,
              boxShadow: `0 0 20px ${glow}`,
              transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1), background 0.6s ease, box-shadow 0.6s ease',
            }}
          />
          {/* Shimmer overlay */}
          <div
            className="absolute bottom-0 left-0 right-0 rounded-2xl"
            style={{
              height: fillHeight,
              background: 'linear-gradient(to right, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
              transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>

        {/* Tick marks at 25/50/75% */}
        {[0.25, 0.5, 0.75].map((t) => (
          <div
            key={t}
            className="absolute left-0 right-0"
            style={{
              bottom: `${t * 100}%`,
              height: 1,
              background: 'rgba(255,255,255,0.12)',
            }}
          />
        ))}
      </div>

      {/* Numeric readout */}
      <div className="flex flex-col items-center gap-0.5">
        <span
          className="text-2xl font-bold tabular-nums"
          style={{
            color: fill,
            textShadow: `0 0 12px ${glow}`,
            transition: 'color 0.6s ease, text-shadow 0.6s ease',
          }}
        >
          {current.toFixed(1)}
        </span>
        <span className="text-xs text-slate-500">
          / {max.toFixed(0)} tokens
        </span>
      </div>

      {/* Status badge */}
      <div
        className="text-xs font-semibold px-2 py-0.5 rounded-full"
        style={{
          background: track,
          color: fill,
          border: `1px solid ${fill}40`,
          transition: 'background 0.6s ease, color 0.6s ease',
        }}
      >
        {pct > 0.5 ? 'Healthy' : pct > 0.2 ? 'Low' : pct > 0 ? 'Critical' : 'Exhausted'}
      </div>
    </div>
  );
};
