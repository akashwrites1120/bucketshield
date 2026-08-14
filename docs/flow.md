# Flow — Distributed Token Bucket Rate Limiter

## 1. High-Level Architecture

```
                     ┌──────────────────┐
                     │   React Dashboard│
                     │  (WS client +    │
                     │   HTTP triggers) │
                     └────────┬─────────┘
                              │  WebSocket (live events)
                              │  HTTP (simulate traffic)
                              ▼
                     ┌──────────────────┐
              ┌─────▶│  Load Balancer   │◀─────┐
              │      │ (nginx/Caddy,    │      │
              │      │  round-robin)    │      │
              │      └──────────────────┘      │
              │                                │
     ┌────────▼────────┐              ┌────────▼────────┐
     │ Go Backend #1    │              │ Go Backend #2    │
     │ - HTTP API       │              │ - HTTP API       │
     │ - WS broadcaster │              │ - WS broadcaster │
     │ - No local bucket│              │ - No local bucket│
     │   state          │              │   state          │
     └────────┬────────┘              └────────┬────────┘
              │                                │
              └───────────────┬────────────────┘
                               ▼
                     ┌──────────────────┐
                     │      Redis        │
                     │ (source of truth  │
                     │ for bucket state, │
                     │ Lua script runs   │
                     │ here atomically)  │
                     └──────────────────┘
```

Key point: **neither backend instance holds bucket state in memory.** Every decision hits Redis and runs the same atomic Lua script — that's what makes this "distributed" rather than "just a single process with a mutex."

## 2. Request Lifecycle (single request)

1. Client sends `POST /api/protected` with header `X-Client-ID: client-a`.
2. Load balancer routes to one of N backend instances (round-robin) — the point is the client doesn't know or care which instance handles it.
3. Backend middleware intercepts the request before it reaches the handler:
   a. Extracts `client-a` as the rate-limit key.
   b. Calls Redis: `EVALSHA <script-sha> 1 ratelimit:client-a <max_tokens> <refill_rate> <cost=1>`
   c. Lua script (runs atomically inside Redis, single-threaded, no race possible):
      - Reads current `tokens` and `last_refill_ts` from the hash (or initializes if missing).
      - Gets current time via Redis `TIME`.
      - Computes elapsed time since `last_refill_ts`, adds `elapsed × refill_rate` tokens, capped at `max_tokens`.
      - If `tokens >= cost`: decrement by `cost`, update `last_refill_ts`, return `{allowed=1, tokens_remaining}`.
      - Else: return `{allowed=0, tokens_remaining}` (no decrement).
   d. Backend receives the Lua script's return value.
4. If `allowed`, request proceeds to the actual handler (200 OK + response body). If not, backend responds `429 Too Many Requests` with `Retry-After` header.
5. Backend publishes an event to all WS-connected dashboard clients: `{clientId, allowed, tokensRemaining, maxTokens, timestamp, latencyMs}` — via Redis Pub/Sub (so *any* backend instance's WS clients get the event, not just the instance that handled the request) or directly if only one instance serves WS connections in MVP.
6. Dashboard receives the event over its WebSocket connection and updates the relevant `TokenGauge` + `LiveRequestFeed`.

## 3. Why Redis Pub/Sub for step 5 (important distributed-systems detail)
If backend instance #1 handles the request but the dashboard's WebSocket is connected to instance #2, instance #2 needs to know the event happened. Options:
- **Redis Pub/Sub**: instance #1 publishes to a channel (`ratelimit-events`), all instances subscribe and forward to their own connected WS clients. Simple, matches the "Redis is the coordination point" theme of the whole project.
- **Simpler MVP shortcut**: run only one backend instance that owns WebSocket connections, while multiple instances still handle the actual rate-limited API traffic. Acceptable for MVP; document the tradeoff and treat full Pub/Sub fan-out as the "do it properly" version once the core algorithm is proven.

## 4. Burst Simulation Flow (dashboard-triggered)
1. User clicks "Burst ×20" on Client A's panel.
2. Frontend fires 20 concurrent `POST /api/protected` requests with `X-Client-ID: client-a`.
3. Requests land across backend instances via the load balancer.
4. Each request independently races to Redis and runs the atomic Lua script — this is the real concurrency test, not a simulated one.
5. Dashboard watches the live feed: first ~10 (if `max_tokens=10`) show ALLOWED, the rest show REJECTED, and the gauge visibly drains to 0 and then slowly refills.

## 5. Failure Mode: Redis Unreachable
1. Backend's Redis call times out or errors.
2. Documented policy (choose one, document it, and justify it in the README — this is a good interview talking point either way):
   - **Fail-closed**: reject all requests (safe for the API being protected, bad for availability).
   - **Fail-open**: allow all requests through, log a warning (safe for availability, momentarily removes protection).
3. Recommendation for this project: **fail-closed by default**, configurable — it's the more defensible default for a "protect the API" tool, and choosing it deliberately (with the tradeoff written down) is more impressive than not having thought about it.

## 6. Load Test Flow
1. `k6` script ramps up virtual users hitting `/api/protected` with a mix of client IDs, sustained + burst patterns.
2. Metrics captured: requests/sec achieved, p50/p95/p99 latency, count of 200s vs 429s.
3. Results written to `benchmarks/results.md` and summarized in the top-level README with a short "what this proves" writeup (e.g., "sustained 1,200 req/sec across 2 instances with p99 latency of 4ms added by the rate-limit check").
