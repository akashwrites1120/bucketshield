import React, { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { RateLimitEvent, ConnectionStatus } from '../types';
import type { RollingStats } from '../hooks/useRollingStats';

interface StatsStripProps {
  stats: RollingStats;
  events: RateLimitEvent[];
  status: ConnectionStatus;
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, sub, color = '#818cf8' }) => (
  <div
    className="flex flex-col gap-1 px-5 py-3 rounded-xl"
    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
  >
    <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</div>
    <div className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</div>
    {sub && <div className="text-xs text-slate-600">{sub}</div>}
  </div>
);

const connectionColors: Record<ConnectionStatus, string> = {
  connected: '#22c55e',
  connecting: '#f59e0b',
  disconnected: '#94a3b8',
  error: '#ef4444',
};

const connectionLabels: Record<ConnectionStatus, string> = {
  connected: '● Live',
  connecting: '○ Connecting…',
  disconnected: '○ Disconnected',
  error: '● Error',
};

/**
 * Top stats strip showing req/sec, rejection %, latency, and a miniature
 * rolling throughput sparkline via Recharts.
 */
export const StatsStrip: React.FC<StatsStripProps> = ({ stats, events, status }) => {
  // Build 20-point sparkline bucketed by second
  const sparkData = useMemo(() => {
    const now = Date.now();
    const buckets: Record<number, { allowed: number; rejected: number }> = {};
    for (const e of events) {
      const bucket = Math.floor((now - e.timestamp) / 500); // 500ms buckets
      if (bucket > 40) continue; // last 20 seconds
      if (!buckets[bucket]) buckets[bucket] = { allowed: 0, rejected: 0 };
      if (e.allowed) buckets[bucket].allowed++;
      else buckets[bucket].rejected++;
    }
    return Array.from({ length: 20 }, (_, i) => ({
      t: i,
      allowed: buckets[i]?.allowed ?? 0,
      rejected: buckets[i]?.rejected ?? 0,
    })).reverse();
  }, [events]);

  const rejColor = stats.rejectionPct > 50 ? '#ef4444' : stats.rejectionPct > 20 ? '#f59e0b' : '#22c55e';

  return (
    <div className="flex items-stretch gap-3 w-full">
      {/* Connection status */}
      <div
        className="flex flex-col justify-center items-center gap-1 px-4 py-3 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', minWidth: 110 }}
      >
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">WebSocket</div>
        <div className="text-sm font-bold" style={{ color: connectionColors[status] }}>
          {connectionLabels[status]}
        </div>
      </div>

      <StatCard
        label="Req / sec"
        value={stats.reqPerSec.toFixed(1)}
        sub="rolling 10s"
        color="#818cf8"
      />
      <StatCard
        label="Rejection %"
        value={`${stats.rejectionPct.toFixed(1)}%`}
        sub={`${stats.totalRejected} rejected`}
        color={rejColor}
      />
      <StatCard
        label="Last Latency"
        value={`${stats.lastLatencyMs.toFixed(2)}ms`}
        sub="Redis round-trip"
        color="#34d399"
      />

      {/* Sparkline */}
      <div
        className="flex-1 flex flex-col gap-1 px-4 py-3 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', minWidth: 200 }}
      >
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Throughput</div>
        <div className="flex-1" style={{ minHeight: 40 }}>
          <ResponsiveContainer width="100%" height={48}>
            <AreaChart data={sparkData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAllowed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorRejected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: '#1a2340', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Area type="monotone" dataKey="allowed" stroke="#22c55e" strokeWidth={1.5} fill="url(#colorAllowed)" name="Allowed" />
              <Area type="monotone" dataKey="rejected" stroke="#ef4444" strokeWidth={1.5} fill="url(#colorRejected)" name="Rejected" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
