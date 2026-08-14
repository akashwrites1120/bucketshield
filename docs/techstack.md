# Tech Stack — Distributed Token Bucket Rate Limiter

## Backend
- **Language**: Go (1.22+)
  - Chosen for native concurrency (goroutines), performance credibility, and idiomatic fit with infra-style projects.
- **HTTP framework**: `net/http` + `chi` router (lightweight, idiomatic, no unnecessary abstraction)
- **Redis client**: `go-redis/redis/v9`
  - Supports `EVAL`/`EVALSHA` for atomic Lua script execution
  - Supports connection pooling out of the box
- **WebSocket**: `gorilla/websocket` for broadcasting live bucket state to the dashboard
- **Config**: environment variables via `envconfig` or a simple `.env` + `godotenv`, with optional Redis-backed runtime overrides for per-client limits

## Rate Limiting Core
- **Algorithm**: Token bucket, implemented as a single **Redis Lua script** (executed via `EVAL`) so the check-and-decrement is atomic.
- **State storage**: Redis, one hash/key per client (`ratelimit:{clientID}` storing `tokens` and `last_refill_ts`).
- **Time source**: Redis server `TIME` command inside the Lua script, to avoid clock skew across multiple app instances.

## Frontend
- **Language/Framework**: React + TypeScript (Vite for tooling — faster dev server than CRA)
- **Charts/visuals**: Recharts for stats charts; a small custom SVG/Canvas component for the token bucket gauge (simple fill animation, no heavy library needed)
- **Real-time updates**: native WebSocket client connecting to the Go backend's WS endpoint
- **Styling**: Tailwind CSS (fast to build a clean single-page dashboard without custom CSS overhead)
- **State management**: React state/hooks only — no Redux needed for a single-page dashboard of this scope

## Infrastructure / Local Dev
- **Redis**: official `redis:7` Docker image, single instance for MVP (Cluster/Sentinel as stretch goal)
- **Containerization**: Docker + `docker-compose` running:
  - 2+ backend instances (to prove distributed correctness)
  - 1 Redis instance
  - 1 frontend dev/build container (or served as static build via nginx)
- **Load balancing (optional, for realism)**: nginx or Caddy in front of the 2+ backend instances, round-robin, so the demo genuinely spreads requests across processes

## Load Testing
- **Tool**: `k6` (scriptable in JS, easy to produce clean throughput/latency/rejection-rate reports) — alternative: `vegeta` if a simpler CLI is preferred
- **Output**: results captured and summarized in README (req/sec sustained, p50/p95/p99 latency, rejection rate under burst)

## Testing
- **Backend**: Go's built-in `testing` package + `testify` for assertions; integration tests spin up a real Redis (via `miniredis` for unit tests, real Redis via docker-compose for integration tests)
- **Concurrency correctness test**: a dedicated test that fires concurrent goroutines simulating multiple backend instances against shared Redis state, asserting no client ever exceeds burst capacity

## Why this stack (for the resume conversation)
- Go + Redis Lua scripting demonstrates atomic distributed operations, not just "I called Redis."
- Running multiple backend instances + a load balancer in `docker-compose` proves the "distributed" claim rather than asserting it.
- React dashboard with WebSockets shows real-time systems thinking, not just a static demo.
- k6 load test numbers give the resume line concrete, defensible substance.
