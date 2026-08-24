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
  if (clientId.includes('client-a')) return '#38bdf8';
  if (clientId.includes('client-b')) return '#34d399';
  return '#fbbf24';
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
      <div className="flex flex-col items-center justify-center h-32 gap-2 text-zinc-600 text-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 animate-pulse-dot" />
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
        <thead className="sticky top-0 z-10" style={{ background: '#0f0f11' }}>
          <tr className="text-left text-zinc-600 uppercase tracking-[0.12em] text-[10px]">
            <th className="py-2 px-3 font-medium">Time</th>
            <th className="py-2 px-3 font-medium">Client</th>
            <th className="py-2 px-3 font-medium">Status</th>
            <th className="py-2 px-3 font-medium text-right">Tokens</th>
            <th className="py-2 px-3 font-medium text-right">Latency</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((evt, i) => (
            <tr
              key={`${evt.timestamp}-${i}`}
              className={`border-b border-white/[0.04] transition-colors duration-150 hover:bg-white/[0.03] ${i === 0 ? 'animate-slide-in-row' : ''}`}
              style={{
                background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
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
                    style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.18)' }}
                  >
                    ✓ ALLOWED
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold tracking-wide"
                    style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.18)' }}
                  >
                    ✗ REJECTED
                  </span>
                )}
              </td>
              <td className="py-1.5 px-3 text-right font-mono tabular-nums text-zinc-400">
                {evt.tokensRemaining.toFixed(1)}/{evt.maxTokens.toFixed(0)}
              </td>
              <td className="py-1.5 px-3 text-right font-mono tabular-nums text-zinc-600">
                {evt.latencyMs.toFixed(2)}ms
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
