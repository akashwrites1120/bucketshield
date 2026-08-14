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
  if (clientId.includes('client-a')) return '#818cf8';
  if (clientId.includes('client-b')) return '#34d399';
  return '#fb923c';
}

const VISIBLE_LIMIT = 100;

/**
 * Scrolling newest-first feed of rate-limit events from the WebSocket stream.
 */
export const LiveRequestFeed: React.FC<LiveRequestFeedProps> = ({ events }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const visible = events.slice(0, VISIBLE_LIMIT);

  // Auto-scroll to top on new events (newest-first layout)
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-600 text-sm">
        Waiting for events… fire some traffic above ↑
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
        <thead className="sticky top-0 z-10" style={{ background: '#0f1629' }}>
          <tr className="text-left text-slate-500 uppercase tracking-wider">
            <th className="py-2 px-3 font-semibold">Time</th>
            <th className="py-2 px-3 font-semibold">Client</th>
            <th className="py-2 px-3 font-semibold">Status</th>
            <th className="py-2 px-3 font-semibold text-right">Tokens</th>
            <th className="py-2 px-3 font-semibold text-right">Latency</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((evt, i) => (
            <tr
              key={`${evt.timestamp}-${i}`}
              className={`border-b border-white/5 transition-colors ${i === 0 ? 'animate-slide-in' : ''}`}
              style={{
                background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
              }}
            >
              <td className="py-1.5 px-3 font-mono text-slate-500" style={{ whiteSpace: 'nowrap' }}>
                {formatTime(evt.timestamp)}
              </td>
              <td className="py-1.5 px-3 font-bold" style={{ color: getClientColor(evt.clientId) }}>
                {CLIENT_LABELS[evt.clientId as ClientId] ?? evt.clientId}
              </td>
              <td className="py-1.5 px-3">
                {evt.allowed ? (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}
                  >
                    ✓ ALLOWED
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
                  >
                    ✗ REJECTED
                  </span>
                )}
              </td>
              <td className="py-1.5 px-3 text-right font-mono text-slate-400">
                {evt.tokensRemaining.toFixed(1)}/{evt.maxTokens.toFixed(0)}
              </td>
              <td className="py-1.5 px-3 text-right font-mono text-slate-500">
                {evt.latencyMs.toFixed(2)}ms
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
