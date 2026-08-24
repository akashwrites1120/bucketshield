
import { useWebSocket } from './hooks/useWebSocket';
import { useRollingStats } from './hooks/useRollingStats';
import { ClientPanel } from './components/ClientPanel';
import { LiveRequestFeed } from './components/LiveRequestFeed';
import { StatsStrip } from './components/StatsStrip';
import { CLIENTS } from './types';

const WS_URL =
  import.meta.env.VITE_WS_URL ??
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

function App() {
  const { events, status } = useWebSocket(WS_URL);
  const stats = useRollingStats(events);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg-900)' }}>
      <header
        className="px-6 py-4 flex items-center justify-between"
        style={{
          background: 'rgba(9,9,11,0.85)',
          borderBottom: '1px solid var(--color-border)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div className="flex items-center gap-3">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 2.5 4.5 5.5v6c0 4.6 3.2 8.1 7.5 10 4.3-1.9 7.5-5.4 7.5-10v-6L12 2.5Z"
              stroke="#fafafa"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="11" r="2.5" fill="#34d399" />
          </svg>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-zinc-50 leading-tight">
              BucketShield
            </h1>
            <p className="text-xs text-zinc-500 leading-tight">
              Distributed Token Bucket Rate Limiter
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-zinc-600">
          <span className="hidden md:inline">Redis Pub/Sub · Lua atomic · round-robin ×2</span>
          <a
            href="https://github.com/akashwrites1120/bucketshield"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg font-medium transition-colors duration-200 text-zinc-400 hover:text-zinc-100 hover:bg-white/5 border border-transparent hover:border-white/10"
          >
            GitHub ↗
          </a>
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-5 p-5 max-w-screen-xl mx-auto w-full">
        <div className="fade-up" style={{ animationDelay: '0ms' }}>
          <StatsStrip stats={stats} events={events} status={status} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CLIENTS.map((clientId, i) => (
            <div key={clientId} className="fade-up" style={{ animationDelay: `${80 + i * 90}ms` }}>
              <ClientPanel clientId={clientId} events={events} />
            </div>
          ))}
        </div>

        <div
          className="card overflow-hidden flex flex-col gap-0 fade-up"
          style={{ animationDelay: '350ms', borderRadius: 'var(--radius-xl)' }}
        >
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-800)' }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${events.length > 0 ? 'animate-pulse-dot' : ''}`}
                style={{
                  background: status === 'connected' ? '#34d399' : status === 'error' ? '#f87171' : '#fbbf24',
                }}
              />
              <h2 className="text-sm font-medium text-zinc-200">Live Request Feed</h2>
              <span className="text-xs text-zinc-600">newest first · last {Math.min(events.length, 100)}</span>
            </div>
            <span className="text-xs font-mono text-zinc-600 tabular-nums">
              {events.length.toLocaleString()} events
            </span>
          </div>
          <div className="px-2">
            <LiveRequestFeed events={events} />
          </div>
        </div>

        <div
          className="rounded-xl px-5 py-4 text-xs text-zinc-500 leading-relaxed fade-up"
          style={{
            background: 'var(--color-bg-800)',
            border: '1px solid var(--color-border)',
            animationDelay: '420ms',
          }}
        >
          <span className="text-zinc-300 font-medium">How it works:</span>
          {' '}Each button fires real HTTP requests through nginx (round-robin across 2 Go instances).
          Every request atomically runs a Lua script inside Redis — no race conditions possible.
          The backend then publishes an event via Redis Pub/Sub, which every instance forwards to its WebSocket clients.
          Token gauges update in real time as you watch the bucket drain and refill.
        </div>
      </main>

      <footer
        className="text-center text-xs text-zinc-700 py-3"
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        BucketShield · Go + Redis + React · <a href="/health" className="hover:text-zinc-500 transition-colors">/health</a>
      </footer>
    </div>
  );
}

export default App;
