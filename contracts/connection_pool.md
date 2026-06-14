# Module Contract: `connection_pool`

**Version:** 0.2.1

---

### `connection_pool`
Managed pool of reusable connections to databases, caches, and external services.

**Functions**
```
acquire(pool_name) → Connection
release(connection_id) → void
getPoolStatus(pool_name) → PoolStatus
resizePool(pool_name, min, max) → void
drainPool(pool_name) → void
getPoolMetrics(pool_name) → PoolMetrics
validateConnection(connection_id) → HealthCheckResult
registerConnectionLeak(connection_id, threshold_ms) → LeakMonitor
setPoolResizePolicy(pool_name, policy) → void
setConnectionHealthCheck(pool_name, config) → void
evictConnection(connection_id) → void
```

**Types**
```
Connection { id, pool_name, acquired_at, idle_since?, borrow_count, last_validated_at?, health: unknown|healthy|degraded|dead }
PoolStatus { name, active, idle, pending, min, max, utilization_pct, leaked: LeakInfo[] }
PoolMetrics { total_acquired, total_released, total_timeout, total_evicted, avg_acquire_ms, avg_usage_ms, avg_idle_ms, leak_count, eviction_count }
PoolConfig { min_idle, max_active, max_idle, acquire_timeout_ms, eviction_interval_ms, max_lifetime_ms, validation_query, test_on_borrow: bool, test_on_return: bool, test_while_idle: bool, leak_detection_threshold_ms }
LeakMonitor { connection_id, threshold_ms, started_at, status: monitoring|leaked|resolved }
HealthCheckResult { connection_id, alive: bool, latency_ms, error? }
ResizePolicy { type: fixed|dynamic|scheduled, min, max, scale_up_factor, scale_down_factor, cooldown_ms }
```

**Invariants**
- `acquire` must return a healthy connection or fail -- it must never return a stale or broken connection
- `release` must return the connection to the pool regardless of whether it is healthy (the pool decides eviction)
- A connection idle longer than `max_idle_time` must be closed and removed from the pool

**Providers:** HikariCP, node-postgres pool, Redis pool, SQLAlchemy pool, custom

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Pool state (active/idle counts) must be accurate within the local process

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once` for pool lifecycle events.
* **Details:** Duplicate release events must be safe -- releasing an already-released connection is a no-op.

### Worker Scaling
* **Policy:** Each worker process or thread should maintain its own pool; pool sharing across processes requires an external broker.

### Multi-Region Behavior
* **Mode:** Pools are always local to the process; multi-region connection routing is handled by the client or mesh layer, not the pool itself.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* When all connections are active and `max_active` is reached, `acquire` must block up to `acquire_timeout_ms` then return a timeout error.
* The pool must apply backpressure to new acquire requests when `leak_count` exceeds 10% of `max_active` -- new acquires should either fail fast or queue with a reduced timeout.

### Connection Validation
* `validateConnection` must run the configured `validation_query` against the connection and mark it `dead` on failure.
* When `test_on_borrow` is enabled, `acquire` must validate the connection before returning it to the caller -- a validation failure must trigger eviction and a retry.
* When `test_on_return` is enabled, `release` must validate the connection before returning it to the pool -- a validation failure must evict the connection rather than pooling it.
* `test_while_idle` must run scheduled health checks on idle connections at the `eviction_interval_ms` interval.

### Leak Detection
* A connection borrowed for longer than `leak_detection_threshold_ms` must be flagged as a potential leak -- the pool must emit a warning event and track the stack trace at acquisition time.
* `registerConnectionLeak` creates a monitor that watches a specific connection; if the borrow exceeds `threshold_ms` without release, the monitor fires a `connection.leaked` event.
* A leaked connection that exceeds 2x the leak detection threshold must be forcibly evicted (`evictConnection`).

### Dynamic Pool Resize
* With `resizePolicy = dynamic`, the pool must automatically scale up when `utilization_pct` exceeds 70% for more than 30 seconds, up to `max` -- scale up is multiplicative by `scale_up_factor`.
* With `resizePolicy = dynamic`, the pool must automatically scale down when `utilization_pct` is below 30% for more than 60 seconds, down to `min` -- scale down respects a `cooldown_ms` to prevent thrashing.

### Error Taxonomy
### Pool Throttling
* Pool must implement a circuit-breaker state: `open` when leak detection rate exceeds threshold, `half-open` for probation, `closed` for normal operation.
* When the circuit is `open`, `acquire` must fail immediately with `pool_circuit_open` instead of waiting.

### Module-Specific Errors
```
acquire:
    pool_exhausted:         All connections active and max_active reached | retry after backoff
    acquire_timeout:        Could not acquire connection within timeout | increase pool size or reduce load

  release:
    invalid_connection:     Connection does not belong to this pool or already released | no action required
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
```
Acquire timeout:
    default:        5 seconds
    on_expiry:      return acquire_timeout

  Idle eviction:
    interval:       configurable, default 30 seconds
    max_idle_time:  configurable, default 10 minutes
    on_expiry:      close and remove idle connection

  Connection max lifetime:
    duration:       configurable, default 30 minutes
    on_expiry:      close connection after current borrow returns it

  Leak detection threshold:
    default:        5 minutes
    on_expiry:      emit leak warning; track stack trace

  Health check interval (when test_while_idle is enabled):
    default:        30 seconds
    on_expiry:      run validation_query on idle connections

  Dynamic resize cooldown:
    default:        60 seconds
    on_expiry:      allow next resize evaluation

  Circuit breaker:
    leak_rate_threshold:    10% of max_active over 60 seconds
    half_open_after_ms:     30 seconds
    on_circuit_open:        fail acquire immediately
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `connection_pool.<function>`.
* **Telemetry Metrics:**
```
blueprint_connection_pool_active_current          gauge { pool_name }
  blueprint_connection_pool_idle_current            gauge { pool_name }
  blueprint_connection_pool_pending_current          gauge { pool_name }
  blueprint_connection_pool_acquire_duration_ms      histogram { pool_name }
  blueprint_connection_pool_evictions_total           { pool_name, reason }
  blueprint_connection_pool_leak_count                gauge { pool_name }
  blueprint_connection_pool_circuit_breaker            gauge { pool_name, state }
  blueprint_connection_pool_health_check_duration_ms   histogram { pool_name }
  blueprint_connection_pool_validation_failures_total  { pool_name }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none -- infrastructure primitive)
* **Emits To:** (none)
* **Recommends:** circuit_breaker, health, telemetry
