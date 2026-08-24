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

const connectionColors: Record<ConnectionStatus, string> = {
  connected: '#34d399',
  connecting: '#fbbf24',
  disconnected: '#71717a',
  error: '#f87171',
};

const connectionLabels: Record<ConnectionStatus, string> = {
  connected: 'Live',
  connecting: 'Connecting…',
  disconnected: 'Disconnected',
  error: 'Error',
};

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, sub, color = '#fafafa' }) => (
  <div
    className="card card-hover flex flex-col justify-center gap-0.5 px-5 py-3"
    style={{ minWidth: 130 }}
  >
    <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">{label}</div>
    <div className="text-2xl font-semibold tabular-nums tracking-tight" style={{ color }}>{value}</div>
    {sub && <div className="text-[11px] text-zinc-600">{sub}</div>}
  </div>
);

export const StatsStrip: React.FC<StatsStripProps> = ({ stats, events, status }) => {
  const sparkData = useMemo(() => {
    const now = Date.now();
    const buckets: Record<number, { allowed: number; rejected: number }> = {};
    for (const e of events) {
      const bucket = Math.floor((now - e.timestamp) / 500);
      if (bucket > 40) continue;
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

  const rejColor = stats.rejectionPct > 50 ? '#f87171' : stats.rejectionPct > 20 ? '#fbbf24' : '#34d399';

  return (
    <div className="flex items-stretch gap-3 w-full flex-wrap">
      <div
        className="card card-hover flex flex-col justify-center items-start gap-1 px-5 py-3"
        style={{ minWidth: 110 }}
      >
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">WebSocket</div>
        <div className="flex items-center gap-2">
          <span
            className={`w-1.5 h-1.5 rounded-full ${status === 'connected' ? 'animate-pulse-dot' : ''}`}
            style={{ background: connectionColors[status] }}
          />
          <span className="text-sm font-medium" style={{ color: connectionColors[status] }}>
            {connectionLabels[status]}
          </span>
        </div>
      </div>

      <StatCard
        label="Req / sec"
        value={stats.reqPerSec.toFixed(1)}
        sub="rolling 10s"
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
        color="#38bdf8"
      />

      <div
        className="card flex-1 flex flex-col justify-center gap-1 px-4 py-3"
        style={{ minWidth: 200 }}
      >
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">Throughput · 10s</div>
        <ResponsiveContainer width="100%" height={44}>
          <AreaChart data={sparkData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorAllowed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorRejected" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f87171" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" hide />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                background: '#18181b',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                fontSize: 11,
              }}
              itemStyle={{ color: '#e4e4e7' }}
              cursor={{ stroke: 'rgba(255,255,255,0.15)' }}
            />
            <Area type="monotone" dataKey="allowed" stroke="#34d399" strokeWidth={1.5} fill="url(#colorAllowed)" name="Allowed" />
            <Area type="monotone" dataKey="rejected" stroke="#f87171" strokeWidth={1.5} fill="url(#colorRejected)" name="Rejected" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
