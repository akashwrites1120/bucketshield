
import { useWebSocket } from './hooks/useWebSocket';
import { useRollingStats } from './hooks/useRollingStats';
import { ClientPanel } from './components/ClientPanel';
import { LiveRequestFeed } from './components/LiveRequestFeed';
import { StatsStrip } from './components/StatsStrip';
import { CLIENTS } from './types';

const WS_URL =
  import.meta.env.VITE_WS_URL ??
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

const GITHUB_URL = 'https://github.com/akashwrites1120/bucketshield';

function App() {
  const { events, status } = useWebSocket(WS_URL);
  const stats = useRollingStats(events);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>
      <header
        className="px-6 py-3.5 flex items-center justify-between"
        style={{
          background: 'rgba(247, 247, 245, 0.8)',
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
              stroke="#18181b"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="11" r="2.5" fill="#059669" />
          </svg>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-zinc-900 leading-tight">
              BucketShield
            </h1>
            <p className="text-xs text-zinc-500 leading-tight">
              Distributed Token Bucket Rate Limiter
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="hidden lg:inline font-mono">Redis Pub/Sub · Lua atomic · round-robin ×2</span>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full font-medium transition-all duration-200 text-zinc-800 hover:text-white bg-white border border-zinc-200 hover:bg-zinc-900 hover:border-zinc-900 shadow-sm"
          >
            <GitHubIcon />
            GitHub
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
            className="px-5 py-3 flex items-center justify-between bg-zinc-50/70"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${events.length > 0 ? 'animate-pulse-dot' : ''}`}
                style={{
                  background:
                    status === 'connected' ? '#059669' : status === 'error' ? '#dc2626' : '#d97706',
                }}
              />
              <h2 className="text-sm font-medium text-zinc-900">Live Request Feed</h2>
              <span className="text-xs text-zinc-400">newest first · last {Math.min(events.length, 100)}</span>
            </div>
            <span className="text-xs font-mono text-zinc-400 tabular-nums">
              {events.length.toLocaleString()} events
            </span>
          </div>
          <div className="px-2">
            <LiveRequestFeed events={events} />
          </div>
        </div>

        <div
          className="rounded-xl px-5 py-4 text-xs text-zinc-600 leading-relaxed fade-up"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            animationDelay: '420ms',
          }}
        >
          <span className="text-zinc-900 font-medium">How it works:</span>
          {' '}Each button fires real HTTP requests through nginx (round-robin across 2 Go instances).
          Every request atomically runs a Lua script inside Redis — no race conditions possible.
          The backend then publishes an event via Redis Pub/Sub, which every instance forwards to its WebSocket clients.
          Token gauges update in real time as you watch the bucket drain and refill.
        </div>
      </main>

      <footer
        className="text-center text-xs text-zinc-400 py-3 flex items-center justify-center gap-1.5"
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        BucketShield · Go + Redis + React ·{' '}
        <a href="/health" className="hover:text-zinc-700 transition-colors underline underline-offset-2 decoration-zinc-300">
          /health
        </a>
      </footer>
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export default App;
