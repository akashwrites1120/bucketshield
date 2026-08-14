# Frontend Spec — Rate Limiter Dashboard

## Purpose
The frontend is a **single-page live demo dashboard**, not a full application. Its only job: make the token bucket algorithm's behavior (burst handling, refill, per-client isolation, rejection under load) visually obvious in real time. Someone should be able to watch it for 30 seconds and understand the whole system.

## Layout (single page)

```
┌─────────────────────────────────────────────────────────┐
│  Header: "Distributed Token Bucket Rate Limiter"         │
│  Aggregate stats strip: req/sec | rejection % | p99 ms   │
├─────────────────────────────────────────────────────────┤
│  Client Panel A       Client Panel B       Client Panel C│
│  ┌─────────────┐      ┌─────────────┐      ┌────────────┐│
│  │ Token gauge │      │ Token gauge │      │ Token gauge││
│  │ (fill/drain)│      │ (fill/drain)│      │ (fill/drain││
│  └─────────────┘      └─────────────┘      └────────────┘│
│  Burst | Sustained     Burst | Sustained    Burst | Sust. │
│  controls              controls             controls      │
├─────────────────────────────────────────────────────────┤
│  Live Request Feed (scrolling, newest on top)             │
│  [12:03:41] Client A  ALLOWED   tokens: 7/10               │
│  [12:03:41] Client A  ALLOWED   tokens: 6/10               │
│  [12:03:42] Client A  REJECTED  tokens: 0/10   429         │
│  ...                                                       │
└─────────────────────────────────────────────────────────┘
```

## Components

### 1. `TokenGauge`
- Props: `current: number`, `max: number`, `clientId: string`
- Visual: vertical or circular fill bar, animates smoothly on change (CSS transition, not re-render jump) so draining/refilling is visible, not just a number changing.
- Color shifts: green when >50% full, amber 20–50%, red <20% — reinforces "about to get throttled" visually.

### 2. `TrafficControls`
- Props: `clientId: string`, `onBurst: (count: number) => void`, `onSustained: (rate: number, durationSec: number) => void`
- UI: a "Burst ×N" button (fires N requests near-instantly) and a slider + "Start sustained load" button (fires at rate/sec for a duration).
- These call the backend's sample protected endpoint directly (or a `/simulate` helper endpoint if you want the frontend to not need real request-generation logic).

### 3. `LiveRequestFeed`
- Subscribes to the WebSocket stream from the backend.
- Renders newest-first, auto-scrolling list, capped at ~100 visible entries (virtualize or just truncate — no need for infinite scroll here).
- Each row: timestamp, client ID, allowed/rejected badge, remaining tokens.

### 4. `StatsStrip`
- Aggregate values computed client-side from the WebSocket event stream (rolling window, e.g., last 10 seconds) or pulled from a backend `/stats` endpoint if you want the backend to own the math.
- Shows: current req/sec, rejection % (rolling), and last observed request latency.

### 5. `ClientPanel`
- Wraps `TokenGauge` + `TrafficControls` for one client, so panels are just repeated for each simulated client (A/B/C) — proves isolation because you can burst Client A and visually confirm B/C are untouched.

## Data Flow
1. On load, frontend opens a WebSocket connection to the Go backend (`/ws`).
2. Backend pushes an event on every rate-limit decision: `{ clientId, allowed, tokensRemaining, maxTokens, timestamp, latencyMs }`.
3. Frontend updates the relevant `TokenGauge` and prepends to `LiveRequestFeed` on each event.
4. `TrafficControls` buttons trigger real HTTP requests against the backend's protected endpoint (not fake/simulated client-side) — this is what makes the demo "real," not staged.
5. `StatsStrip` recomputes from a rolling buffer of recent WS events.

## Non-Goals for Frontend
- No routing/multiple pages — everything lives on one screen.
- No user accounts/auth — client IDs are just fixed demo labels (`client-a`, `client-b`, `client-c`).
- No persistence — dashboard state resets on refresh; it's a live view, not a historical analytics tool.
- No design system beyond Tailwind utility classes — polish is welcome but not the point of this project.

## Tech Notes
- Vite + React + TypeScript scaffold (`npm create vite@latest -- --template react-ts`)
- Tailwind for styling
- Recharts only if you want the `StatsStrip` to show a small rolling line/sparkline chart for req/sec — otherwise plain numbers are fine and simpler
- Keep WebSocket reconnect logic simple but present (exponential backoff on disconnect) — a dropped WS connection shouldn't silently freeze the dashboard
