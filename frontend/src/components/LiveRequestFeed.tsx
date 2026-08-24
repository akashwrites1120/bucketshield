import React, { useRef, useEffect } from 'react';
import type { RateLimitEvent, ClientId } from '../types';
import { CLIENT_LABELS } from '../types';

interface LiveRequestFeedProps {
  events: RateLimitEvent[];
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
}

function getClientColor(clientId: string): string {
  if (clientId.includes('client-a')) return '#2563eb';
  if (clientId.includes('client-b')) return '#059669';
  return '#d97706';
}

const VISIBLE_LIMIT = 100;

export const LiveRequestFeed: React.FC<LiveRequestFeedProps> = ({ events }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const visible = events.slice(0, VISIBLE_LIMIT);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2 text-zinc-400 text-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-pulse-dot" />
        Waiting for events… fire some traffic above
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="overflow-y-auto"
      style={{ maxHeight: 280 }}
      id="live-feed"
    >
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 z-10" style={{ background: '#ffffff' }}>
          <tr className="text-left text-zinc-400 uppercase tracking-[0.12em] text-[10px]">
            <th className="py-2 px-3 font-medium" style={{ borderBottom: '1px solid var(--color-border)' }}>Time</th>
            <th className="py-2 px-3 font-medium" style={{ borderBottom: '1px solid var(--color-border)' }}>Client</th>
            <th className="py-2 px-3 font-medium" style={{ borderBottom: '1px solid var(--color-border)' }}>Status</th>
            <th className="py-2 px-3 font-medium text-right" style={{ borderBottom: '1px solid var(--color-border)' }}>Tokens</th>
            <th className="py-2 px-3 font-medium text-right" style={{ borderBottom: '1px solid var(--color-border)' }}>Latency</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((evt, i) => (
            <tr
              key={`${evt.timestamp}-${i}`}
              className={`transition-colors duration-150 hover:bg-zinc-50 ${i === 0 ? 'animate-slide-in-row' : ''}`}
              style={{
                borderBottom: '1px solid rgba(24,24,27,0.04)',
                background: i % 2 === 0 ? 'rgba(24,24,27,0.01)' : 'transparent',
              }}
            >
              <td className="py-1.5 px-3 font-mono tabular-nums text-zinc-500" style={{ whiteSpace: 'nowrap' }}>
                {formatTime(evt.timestamp)}
              </td>
              <td className="py-1.5 px-3 font-medium" style={{ color: getClientColor(evt.clientId) }}>
                {CLIENT_LABELS[evt.clientId as ClientId] ?? evt.clientId}
              </td>
              <td className="py-1.5 px-3">
                {evt.allowed ? (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold tracking-wide"
                    style={{ background: 'rgba(5,150,105,0.08)', color: '#047857', border: '1px solid rgba(5,150,105,0.18)' }}
                  >
                    ✓ ALLOWED
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold tracking-wide"
                    style={{ background: 'rgba(220,38,38,0.06)', color: '#b91c1c', border: '1px solid rgba(220,38,38,0.18)' }}
                  >
                    ✗ REJECTED
                  </span>
                )}
              </td>
              <td className="py-1.5 px-3 text-right font-mono tabular-nums text-zinc-600">
                {evt.tokensRemaining.toFixed(1)}/{evt.maxTokens.toFixed(0)}
              </td>
              <td className="py-1.5 px-3 text-right font-mono tabular-nums text-zinc-400">
                {evt.latencyMs.toFixed(2)}ms
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
