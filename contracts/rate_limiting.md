# Module Contract: `rate_limiting`

**Version:** 0.1.0

---

### `rate_limiting`
Request throttling and quota enforcement.

**Functions**
```
checkLimit(key, limit, window) → RateLimitResult
consumeToken(key, limit, window, cost?) → RateLimitResult
resetLimit(key) → void
getLimitStatus(key) → LimitStatus
setCustomLimit(key, limit, window) → void
```

**Types**
```
RateLimitResult { allowed, remaining, reset_at, retry_after? }
LimitStatus { current, limit, window, reset_at }
LimitWindow = second | minute | hour | day
```

**Invariants**
- `checkLimit` must not consume a token -- it must be a read-only check. Repeated calls to `checkLimit` alone must never decrement the remaining count
- Limits must be enforced atomically -- race conditions must not allow over-consumption. Implementations must use Lua scripts, stored procedures, or compare-and-swap operations; read-check-write patterns are a contract violation
- `consumeToken` must never return `allowed: true` when the limit would be exceeded -- exactly N tokens may pass per window, never N+1
- `resetLimit` must set the current count to zero and reset the window start time atomically
- `setCustomLimit` must not allow a limit of zero or negative values -- the minimum enforceable limit is 1
- `getLimitStatus` must return the same `remaining` value that the next `consumeToken` call would observe, absent concurrent modifications

**Providers:** Redis (sliding window, token bucket), Upstash, custom

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Limit state must be immediately consistent within a single region. Cross-region limit state is eventually consistent with bounded staleness of at most 1 second.

### Runtime Delivery Model
* **Scope:** Rate limits must be explicit per endpoint, per key, or per tenant as appropriate.
* **Details:** The module must document burst and sustained limits, not only a single threshold.

### Worker Scaling
* **Policy:** Rate limit evaluation is CPU- and I/O-bound and must scale with request volume. Token bucket refill and window expiry must be handled by background workers independently of the request path.

### Multi-Region Behavior
* **Mode:** Local rate limiting with optional global quota aggregation. Per-region limits are enforced independently; global aggregate limits require a centralized counter with higher latency.
* **Details:** If global rate limiting is required, the module must document the tradeoff between consistency and latency. Default is per-region enforcement.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* When a limit is exceeded, the module must return a predictable `retry_after` or equivalent rejection signal.
* The implementation must not allow over-consumption under concurrent load.
* If the backing store is unavailable, the module must fail-open (permit the request and log a warning) or fail-closed depending on deployment configuration. The default is fail-open for availability.

### Algorithm
* **Recommended:** Sliding window counter for distributed rate limiting (Redis sorted sets + Lua). Token bucket for burst-tolerant per-client limits. Leaky bucket for smoothing request peaks into a steady throughput.
* **Atomicity:** All limit checks and consumption must be atomic. Read-check-write patterns are not permitted -- use Lua scripts or equivalent server-side atomic operations.
* **Accuracy vs performance tradeoff:** Sliding window log provides exact counts but higher memory. Sliding window counter provides approximate counts with lower memory. Token bucket provides burst tolerance. The implementation must document which algorithm is used and the tradeoff.

### Storage Model
* **Model:** Strongly consistent quota store.
* **Details:** The backing store may be Redis, a relational database, or another atomic counter store, but limit updates must be atomic. Keys must have a TTL equal to the window duration plus a safety margin of 1 minute to prevent unbounded memory growth.

### Error Taxonomy
### Module-Specific Errors
```
checkLimit:
    store_unavailable:        Rate limit store is unreachable | check deployment configuration

  consumeToken:
    store_unavailable:        Rate limit store is unreachable | fail-open or fail-closed per config

  setCustomLimit:
    invalid_limit:            Limit must be greater than zero | provide a positive integer
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
checkLimit        → rate_limit.checked              { key, allowed, remaining, window }
consumeToken      → rate_limit.token_consumed       { key, allowed, remaining, cost }
resetLimit        → rate_limit.reset                 { key }
limit_exceeded    → rate_limit.exceeded              { key, current, limit, retry_after }
```

### Temporal Constraints
```
Rate limit window:
    TTL:            window duration + 1 minute safety margin
    on_expiry:      key is removed; next request starts a fresh window

  Token bucket refill:
    interval:       configurable per key or per endpoint
    on_refill:      tokens are added up to the burst limit; excess is discarded

  Idle key cleanup:
    duration:       2x the longest configured window
    on_expiry:      key is eligible for eviction; no impact on future requests
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `rate_limiting.<function>`.
* **Telemetry Metrics:**
```
blueprint_rate_limiting_checks_total               { key, allowed }
blueprint_rate_limiting_tokens_consumed_total       { key, cost }
blueprint_rate_limiting_limit_exceeded_total        { key }
blueprint_rate_limiting_store_latency_ms            histogram { operation }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details). Rate limit check P99 must be < 5ms.

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events
* **Recommends:** caching, circuit_breaker
