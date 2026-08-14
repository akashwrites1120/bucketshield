import { useMemo, useRef } from 'react';
import type { RateLimitEvent } from '../types';

const WINDOW_MS = 10_000; // rolling 10-second window

export interface RollingStats {
  reqPerSec: number;
  rejectionPct: number;
  lastLatencyMs: number;
  totalAllowed: number;
  totalRejected: number;
}

/**
 * Computes rolling aggregate stats from a stream of rate-limit events.
 * Stats are calculated over the last WINDOW_MS milliseconds.
 */
export function useRollingStats(events: RateLimitEvent[]): RollingStats {
  // We only need the last N seconds, so filter by timestamp
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  const windowEvents = useMemo(
    () => events.filter((e) => e.timestamp >= cutoff),
    // Intentionally include `cutoff` as a dep via `events` change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events]
  );

  const allowed = windowEvents.filter((e) => e.allowed).length;
  const rejected = windowEvents.filter((e) => !e.allowed).length;
  const total = allowed + rejected;

  const reqPerSec = total / (WINDOW_MS / 1000);
  const rejectionPct = total > 0 ? (rejected / total) * 100 : 0;
  const lastLatencyMs = events.length > 0 ? events[0].latencyMs : 0;

  // cumulative totals across all time
  const totalRef = useRef({ allowed: 0, rejected: 0 });
  totalRef.current.allowed += events.filter(
    (e) => e.allowed && e.timestamp >= cutoff
  ).length;

  return {
    reqPerSec: parseFloat(reqPerSec.toFixed(1)),
    rejectionPct: parseFloat(rejectionPct.toFixed(1)),
    lastLatencyMs: parseFloat(lastLatencyMs.toFixed(2)),
    totalAllowed: allowed,
    totalRejected: rejected,
  };
}
