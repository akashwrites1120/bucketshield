import React, { useMemo } from 'react';
import type { RateLimitEvent, ClientId } from '../types';
import { CLIENT_LABELS } from '../types';
import { TokenGauge } from './TokenGauge';
import { TrafficControls } from './TrafficControls';

interface ClientPanelProps {
  clientId: ClientId;
  events: RateLimitEvent[];
}

const PANEL_ACCENT_COLORS: Record<ClientId, { accent: string; glow: string; border: string }> = {
  'client-a': { accent: '#818cf8', glow: 'rgba(129,140,248,0.15)', border: 'rgba(129,140,248,0.25)' },
  'client-b': { accent: '#34d399', glow: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.25)' },
  'client-c': { accent: '#fb923c', glow: 'rgba(251,146,60,0.15)', border: 'rgba(251,146,60,0.25)' },
};

/**
 * Full client panel combining TokenGauge + TrafficControls.
 * One panel per simulated client (A/B/C) to prove per-client isolation.
 */
export const ClientPanel: React.FC<ClientPanelProps> = ({ clientId, events }) => {
  const { accent, glow, border } = PANEL_ACCENT_COLORS[clientId];

  // Derive current token state from the most recent event for this client
  const clientEvents = useMemo(
    () => events.filter((e) => e.clientId === clientId),
    [events, clientId]
  );
  const latest = clientEvents[0];
  const tokensRemaining = latest?.tokensRemaining ?? 10;
  const maxTokens = latest?.maxTokens ?? 10;

  // Recent activity stats for this client
  const recent = clientEvents.slice(0, 20);
  const allowedCount = recent.filter((e) => e.allowed).length;
  const rejectedCount = recent.filter((e) => !e.allowed).length;

  return (
    <div
      className="flex flex-col gap-4 rounded-2xl p-5 transition-all duration-300"
      style={{
        background: `linear-gradient(135deg, rgba(255,255,255,0.04) 0%, ${glow} 100%)`,
        border: `1px solid ${border}`,
        boxShadow: `0 8px 32px ${glow}`,
      }}
      id={`client-panel-${clientId}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-2.5 h-2.5 rounded-full animate-pulse-slow"
            style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
          />
          <h2 className="text-base font-bold" style={{ color: accent }}>
            {CLIENT_LABELS[clientId]}
          </h2>
          <code className="text-xs text-slate-600 font-mono">{clientId}</code>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
            ✓ {allowedCount}
          </span>
          <span className="px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
            ✗ {rejectedCount}
          </span>
        </div>
      </div>

      {/* Gauge + Controls side by side */}
      <div className="flex gap-5 items-start">
        <div className="flex-shrink-0">
          <TokenGauge current={tokensRemaining} max={maxTokens} />
        </div>
        <div className="flex-1 min-w-0">
          <TrafficControls clientId={clientId} />
        </div>
      </div>

      {/* Mini activity bar for this client */}
      {recent.length > 0 && (
        <div>
          <div className="text-xs text-slate-600 mb-1.5 uppercase tracking-widest font-semibold">Recent Activity</div>
          <div className="flex gap-0.5 h-2">
            {recent.slice(0, 20).reverse().map((e, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm transition-all duration-200"
                style={{
                  background: e.allowed ? '#22c55e' : '#ef4444',
                  opacity: 0.3 + (i / 20) * 0.7,
                }}
                title={e.allowed ? 'Allowed' : 'Rejected'}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
