# Policy Contract: `operational_runbooks`
**Version:** 1.0.0

## Scope
Service reliability, connection pool management, health checks, circuit breakers, and production incident response.

## Rules
- **Rule 1 (Connection Pool Safety):** All connection checkouts must release the connection back to the pool in a `finally` block or context manager. Connection timeouts must be set to a maximum of 2,000ms to prevent cascading thread pool starvation.
- **Rule 2 (Graceful Shutdown):** Upon receiving `SIGTERM` or `SIGINT`, services must:
  1. Stop accepting new incoming connections.
  2. Complete in-progress active requests (within a 15-second grace window).
  3. Close database connection pools, Redis clients, and event queues.
  4. Terminate the process with status `0`.
- **Rule 3 (Health Check Separation):** Services must expose two separate health check endpoints:
  - `/health/live`: Liveness probe. Returns `200 OK` instantly as long as the HTTP thread pool is active. Must not perform external dependency queries (DB/Redis) to avoid false-positive restarts.
  - `/health/ready`: Readiness probe. Verifies that the database, cache, and queue connections are functional. Returns `503 Service Unavailable` if critical dependencies are unreachable.
- **Rule 4 (Circuit Breakers):** Every external HTTP/gRPC service call must be wrapped in a circuit breaker. If the failure rate exceeds 50% over a 30-second window, the breaker must trip `OPEN` and fast-fail subsequent requests with a `provider_error` and a `retry_after` header, preventing downstream caller exhaustion.
- **Rule 5 (Structured Logging Invariants):** Log outputs must be JSON-structured. Every log entry must include `trace_id`, `span_id`, `module`, and `function` context. Raw credentials, tokens, or personal identifiable information (PII) must be masked or stripped before emission.
- **Rule 6 (Memory Leak Triage):** When diagnosing high memory/OOM incidents:
  1. Generate a heap dump immediately.
  2. Inspect high-cardinality collections and event emitter listeners.
  3. Do not just increase container limit; identify the growth factor.
