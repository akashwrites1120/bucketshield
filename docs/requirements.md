# Requirements — Distributed Token Bucket Rate Limiter

## 1. Functional Requirements

### 1.1 Rate Limiting Core
- FR1: The system SHALL implement the token bucket algorithm: each client has a bucket with a max capacity (burst size) and a refill rate (tokens/sec).
- FR2: Each incoming request SHALL attempt to consume 1 token (configurable cost per request in stretch scope).
- FR3: If a token is available, the request SHALL be allowed and the bucket decremented atomically.
- FR4: If no token is available, the request SHALL be rejected with HTTP 429 and a `Retry-After` header.
- FR5: Bucket state (current token count, last refill timestamp) SHALL be stored in Redis, keyed per client identifier (API key or IP).
- FR6: Token refill SHALL be calculated lazily on each request (elapsed time × refill rate), not via a background job — no cron/ticker needed.
- FR7: The check-and-decrement operation SHALL be atomic across concurrent requests, including requests arriving at different backend instances simultaneously.

### 1.2 Configuration
- FR8: Bucket capacity and refill rate SHALL be configurable per client, with a global default fallback.
- FR9: Configuration SHALL be adjustable at runtime (e.g., via a config endpoint or Redis-stored config) without restarting the service.

### 1.3 API
- FR10: The system SHALL expose at least one sample protected endpoint that runs requests through the limiter.
- FR11: The system SHALL expose a status endpoint returning current token count and limit config for a given client ID.
- FR12: The system SHALL expose a WebSocket (or SSE) stream broadcasting real-time bucket state changes and allow/reject events, for dashboard consumption.

### 1.4 Dashboard
- FR13: The dashboard SHALL display live token levels per tracked client as a draining/refilling visual (gauge or bar).
- FR14: The dashboard SHALL display a live feed of individual requests, tagged allowed (green) or rejected (red).
- FR15: The dashboard SHALL provide controls to simulate traffic: a "burst" trigger (N requests at once) and a "sustained rate" control (M requests/sec for a duration).
- FR16: The dashboard SHALL support viewing at least 2–3 simulated clients side by side to demonstrate per-client isolation.
- FR17: The dashboard SHALL display aggregate stats: current requests/sec, rejection rate, and observed latency.

### 1.5 Distributed Correctness
- FR18: The system SHALL support running 2+ backend instances concurrently, all reading/writing the same Redis instance, with no per-instance in-memory bucket state.
- FR19: A load test running concurrent requests across multiple instances SHALL NOT allow any client to exceed its configured burst capacity.

## 2. Non-Functional Requirements

### 2.1 Performance
- NFR1: The rate-limit check (Redis round trip + Lua execution) SHOULD add no more than ~1–2ms p99 latency overhead per request under normal load.
- NFR2: The system SHOULD sustain at least 1,000 req/sec in local load testing without error (target number to validate/adjust once hardware is known).
- NFR3: Load test results (throughput, p50/p95/p99 latency, rejection rate) SHALL be documented in the README.

### 2.2 Correctness & Concurrency
- NFR4: All bucket read-modify-write logic SHALL execute as a single atomic Redis operation (Lua script via `EVAL`/`EVALSHA`), never as separate GET + SET calls from application code.
- NFR5: Time-based calculations SHALL use a single consistent time source (Redis server time) to avoid clock-skew bugs across instances.

### 2.3 Observability
- NFR6: The system SHALL log every allow/reject decision with client ID, timestamp, and remaining tokens.
- NFR7: The system SHOULD expose basic metrics (requests total, rejections total, current bucket levels) in a format suitable for scraping (Prometheus format is a stretch goal; structured logs/JSON are the MVP baseline).

### 2.4 Reliability
- NFR8: If Redis is temporarily unreachable, the system SHALL fail in a clearly defined, documented way (fail-open or fail-closed — decision to be made and documented, not left implicit).

### 2.5 Developer Experience
- NFR9: The project SHALL run locally via a single `docker-compose up` (backend instances + Redis + frontend).
- NFR10: Setup steps SHALL be documented in the README such that a new developer can run the full demo in under 5 minutes.

## 3. Out of Scope (for this iteration)
- Authentication/authorization beyond a simple API key header for client identification
- Multi-region/multi-Redis-cluster replication
- Billing/quota systems beyond raw rate limiting
- Persisting historical analytics beyond what's needed for the live dashboard
