import React, { useMemo } from 'react';
import type { RateLimitEvent, ClientId } from '../types';
import { CLIENT_LABELS } from '../types';
import { TokenGauge } from './TokenGauge';
import { TrafficControls } from './TrafficControls';

interface ClientPanelProps {
  clientId: ClientId;
  events: RateLimitEvent[];
}

const PANEL_ACCENTS: Record<ClientId, string> = {
  'client-a': '#2563eb',
  'client-b': '#059669',
  'client-c': '#d97706',
};

export const ClientPanel: React.FC<ClientPanelProps> = ({ clientId, events }) => {
  const accent = PANEL_ACCENTS[clientId];

  const clientEvents = useMemo(
    () => events.filter((e) => e.clientId === clientId),
    [events, clientId]
  );
  const latest = clientEvents[0];
  const tokensRemaining = latest?.tokensRemaining ?? 10;
  const maxTokens = latest?.maxTokens ?? 10;

  const recent = clientEvents.slice(0, 20);
  const allowedCount = recent.filter((e) => e.allowed).length;
  const rejectedCount = recent.filter((e) => !e.allowed).length;

  return (
    <div
      className="card card-hover h-full flex flex-col gap-4 p-5"
      id={`client-panel-${clientId}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className="w-2 h-2 rounded-full animate-pulse-dot"
            style={{ background: accent }}
          />
          <h2 className="text-base font-medium tracking-tight text-zinc-900">
            {CLIENT_LABELS[clientId]}
          </h2>
          <code className="text-[11px] text-zinc-400 font-mono">{clientId}</code>
        </div>
        <div className="flex gap-1.5 text-xs font-mono tabular-nums">
          <span
            className="px-2 py-0.5 rounded-full font-medium transition-transform duration-200"
            style={{ background: 'rgba(5,150,105,0.08)', color: '#047857', border: '1px solid rgba(5,150,105,0.18)' }}
          >
            ✓ {allowedCount}
          </span>
          <span
            className="px-2 py-0.5 rounded-full font-medium"
            style={{ background: 'rgba(220,38,38,0.06)', color: '#b91c1c', border: '1px solid rgba(220,38,38,0.18)' }}
          >
            ✗ {rejectedCount}
          </span>
        </div>
      </div>

      <div className="flex gap-6 items-start flex-1">
        <div className="flex-shrink-0">
          <TokenGauge current={tokensRemaining} max={maxTokens} accent={accent} />
        </div>
        <div className="flex-1 min-w-0">
          <TrafficControls clientId={clientId} accent={accent} />
        </div>
      </div>

      {recent.length > 0 && (
        <div>
          <div className="text-[10px] text-zinc-400 mb-1.5 uppercase tracking-[0.14em] font-medium">Recent Activity</div>
          <div className="flex gap-0.5 h-1.5">
            {recent.slice(0, 20).reverse().map((e, i) => (
              <div
                key={i}
                className="flex-1 rounded-full animate-pop-in"
                style={{
                  background: e.allowed ? '#059669' : '#dc2626',
                  opacity: 0.35 + (i / 20) * 0.65,
                  animationDelay: `${i * 12}ms`,
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
