
import { useWebSocket } from './hooks/useWebSocket';
import { useRollingStats } from './hooks/useRollingStats';
import { ClientPanel } from './components/ClientPanel';
import { LiveRequestFeed } from './components/LiveRequestFeed';
import { StatsStrip } from './components/StatsStrip';
import { CLIENTS } from './types';

// In dev, Vite proxies /ws → ws://localhost:8080/ws
// In production (served from nginx alongside the Go API), use the same host
const WS_URL =
  import.meta.env.VITE_WS_URL ??
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

function App() {
  const { events, status } = useWebSocket(WS_URL);
  const stats = useRollingStats(events);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg-900)' }}>
      {/* ── Header ── */}
      <header
        className="px-6 py-4 flex items-center justify-between"
        style={{
          background: 'rgba(10,14,26,0.9)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
            style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', boxShadow: '0 0 16px rgba(99,102,241,0.5)' }}
          >
            🪣
          </div>
          <div>
            <h1 className="text-sm font-bold text-gradient leading-tight">
              BucketShield
            </h1>
            <p className="text-xs text-slate-600 leading-tight">
              Distributed Token Bucket Rate Limiter
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>Redis Pub/Sub · Lua atomic · 2 backend instances</span>
          <a
            href="https://github.com/akashwrites1120/bucketshield"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 rounded-lg font-semibold transition-colors"
            style={{
              background: 'rgba(99,102,241,0.15)',
              color: '#818cf8',
              border: '1px solid rgba(99,102,241,0.3)',
            }}
          >
            GitHub ↗
          </a>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col gap-5 p-5 max-w-screen-xl mx-auto w-full">

        {/* Stats Strip */}
        <StatsStrip stats={stats} events={events} status={status} />

        {/* ── Client Panels ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CLIENTS.map((clientId) => (
            <ClientPanel key={clientId} clientId={clientId} events={events} />
          ))}
        </div>

        {/* ── Live Request Feed ── */}
        <div
          className="rounded-2xl flex flex-col gap-0"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <h2 className="text-sm font-bold text-slate-300">Live Request Feed</h2>
              <span className="text-xs text-slate-600">newest first · last {Math.min(events.length, 100)} events</span>
            </div>
            <span className="text-xs font-mono text-slate-600">
              {events.length} total
            </span>
          </div>
          <div className="px-2">
            <LiveRequestFeed events={events} />
          </div>
        </div>

        {/* ── Architecture Note ── */}
        <div
          className="rounded-xl px-5 py-4 text-xs text-slate-500 leading-relaxed"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          <span className="text-slate-400 font-semibold">How it works:</span>
          {' '}Each button fires real HTTP requests through nginx (round-robin across 2 Go instances).
          Every request atomically runs a Lua script inside Redis — no race conditions possible.
          The backend then publishes an event via Redis Pub/Sub, which every instance forwards to its WebSocket clients.
          Token gauges update in real time as you watch the bucket drain and refill.
        </div>
      </main>

      {/* ── Footer ── */}
      <footer
        className="text-center text-xs text-slate-700 py-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        BucketShield · Go + Redis + React · <a href="/health" className="hover:text-slate-500 transition-colors">/health</a>
      </footer>
    </div>
  );
}

export default App;
