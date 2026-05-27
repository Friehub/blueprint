# Module Contract: `rate_limiting`

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
- `checkLimit` must not consume a token — it must be a read-only check
- Limits must be enforced atomically — race conditions must not allow over-consumption

**Providers:** Redis (sliding window, token bucket), Upstash, custom

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Standard transactional consistency

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
* None explicitly defined.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `rate_limiting.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** (none)
* **Recommends:** caching
