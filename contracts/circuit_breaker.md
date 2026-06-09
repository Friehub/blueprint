# Module Contract: `circuit_breaker`

**Version:** 0.1.0

---

### `circuit_breaker`
Failure isolation for external service calls with automated recovery.

**Functions**
```
getState(breaker_name) → BreakerState
trip(breaker_name, reason) → void
recordSuccess(breaker_name) → void
recordFailure(breaker_name) → void
reset(breaker_name) → void
getMetrics(breaker_name) → BreakerMetrics
registerBreaker(name, config) → void
```

**Types**
```
BreakerState { name, state: closed|open|half_open, failure_count, last_failure_at, opened_at }
CircuitBreakerConfig { failure_threshold, recovery_timeout, half_open_max_requests, fallback_strategy }
BreakerMetrics { total_calls, total_failures, total_successes, open_duration_ms }
```

**Invariants**
- `recordFailure` on a closed breaker must transition to `open` when `failure_threshold` is reached within the rolling window
- `trip` must transition directly to `open` regardless of current state (manual override)
- A breaker in `half_open` state must allow at most `half_open_max_requests` concurrent calls before re-evaluating

**Providers:** Resilience4j, Opossum, Polly, custom implementation

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** State transitions are local to the breaker instance; cross-instance state is eventually consistent via shared store if configured

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once` for state transition events.
* **Details:** Duplicate trip events must be safe because tripping an already-open breaker is a no-op.

### Worker Scaling
* **Policy:** Per-breaker evaluation and metric aggregation must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether breaker state is local (per-instance) or shared (backed by distributed store).
* **Details:** Shared breaker state requires a distributed lock to prevent split-brain during recovery.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* When a breaker is open, calls must fail fast with a `circuit_open` error rather than blocking or queueing.

### Error Taxonomy
### Module-Specific Errors
```
getState:
    breaker_not_found:      No breaker registered with that name | register before querying

  trip:
    already_open:           Breaker is already open | no action needed
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
trip              → circuit.tripped            { breaker_name, reason, failure_count }
  recordSuccess     → circuit.closed             { breaker_name, open_duration_ms }
  recordSuccess     → circuit.half_open.success  { breaker_name }
  recordFailure     → circuit.half_open.failure  { breaker_name }
```

### Temporal Constraints
```
Recovery timeout:
    duration:        configurable, default 30 seconds
    on_expiry:       transition from open to half_open

  Failure window:
    duration:        rolling, configurable default 60 seconds
    on_expiry:       old failures are evicted from the count
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `circuit_breaker.<function>`.
* **Telemetry Metrics:**
```
gensense_circuit_breaker_state_changes_total     { breaker_name, state }
  gensense_circuit_breaker_open_duration_ms        histogram { breaker_name }
  gensense_circuit_breaker_calls_total             { breaker_name, result }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none -- infrastructure primitive)
* **Emits To:** events
* **Recommends:** metrics, alerting
