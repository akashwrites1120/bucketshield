# PRD — Distributed Token Bucket Rate Limiter

## 1. Problem Statement
APIs need a way to protect themselves from abusive, buggy, or simply too-frequent clients without rejecting legitimate bursts of traffic outright. A naive fixed-window counter either lets clients burst freely at window edges or unfairly blocks a client that briefly exceeds a smooth average. This project builds a **token bucket rate limiter** that:
- Allows short bursts up to a configurable ceiling
- Refills gradually to a smooth sustained rate
- Works correctly across **multiple backend instances** sharing state in Redis (not per-process, in-memory state)
- Is observable in real time via a dashboard

## 2. Goals
- Build a correct, atomic, distributed token bucket algorithm backed by Redis.
- Prove it works under concurrency: multiple app instances, multiple simultaneous clients, no race conditions.
- Make the behavior visible and demo-able (live dashboard), not just "trust me, curl returns 429."
- Produce real performance numbers (throughput, p99 latency, rejection rate under load) via load testing.

## 3. Non-Goals
- Not building a general-purpose API gateway (no routing, auth, TLS termination).
- Not implementing every rate-limiting algorithm (sliding window, leaky bucket) — token bucket only, though the design should make swapping algorithms plausible as a "future work" talking point.
- Not building a production-grade multi-tenant SaaS product — this is a portfolio/demo project, so scope stays tight and well-tested rather than broad.

## 4. Target Users / Use Case
- **Primary user of the system**: any HTTP API that wants per-client (per-API-key or per-IP) request throttling.
- **Primary "user" of the project**: you, in an interview — this needs to be explainable in 60 seconds and demo-able in 2 minutes.

## 5. Core Features (MVP)
1. **Rate-limited HTTP endpoint** — a sample "protected" API endpoint that checks the limiter before responding.
2. **Token bucket algorithm in Redis**, executed atomically via a Lua script (`EVAL`), keyed per client ID / API key.
3. **Configurable bucket parameters** — max capacity (burst size) and refill rate (tokens/sec), per client or global default.
4. **Multiple backend instances** running simultaneously against the same Redis instance, proving distributed correctness.
5. **Live dashboard** (React) showing:
   - Current token level per client (draining/refilling in real time)
   - Allowed vs. rejected requests as a live feed/timeline
   - Traffic simulation controls (burst button, sustained-rate slider)
6. **Load test suite** producing real throughput/latency/rejection-rate numbers.

## 6. Stretch Goals (post-MVP)
- Redis Cluster / Sentinel for HA, with a talking point on failover behavior.
- Multiple algorithms (sliding window log, leaky bucket) selectable per route, for comparison.
- Per-route + per-client composite limits (e.g., global API limit AND per-user limit).
- gRPC middleware version, reusable as a library.
- Prometheus metrics export + Grafana dashboard as an alternative to the custom React dashboard.

## 7. Success Criteria
- Correctness: under concurrent load from multiple backend instances, no client ever exceeds its configured burst capacity (verified by test, not just eyeballing).
- Demo-ability: someone unfamiliar with the project can watch the dashboard for 30 seconds and understand burst handling and refill.
- Performance: documented p50/p99 latency and max sustained throughput under load test, with numbers good enough to put on a resume line.
- Code quality: clean atomic Redis logic (Lua script) that would survive a "walk me through the race condition you avoided" interview question.

## 8. Key Risks
- **Race conditions**: check-then-decrement done as two separate Redis calls instead of one atomic script. Mitigation: all bucket math happens inside a single Lua script executed via `EVAL`.
- **Clock skew across instances**: token refill math depends on time. Mitigation: use Redis server time (`TIME` command inside the Lua script) as the single source of truth, not each app server's local clock.
- **Over-scoping**: turning this into a full gateway. Mitigation: this PRD's Non-Goals section is the guardrail — re-read it before adding features.

## 9. Deliverables
- Working backend service with rate-limiting middleware
- Redis Lua script implementing token bucket logic
- React dashboard for live visualization
- Load test scripts + results writeup
- README with architecture diagram, setup instructions, and benchmark numbers
