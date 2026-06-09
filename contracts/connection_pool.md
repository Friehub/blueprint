# Module Contract: `connection_pool`

**Version:** 0.1.0

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
```

**Types**
```
Connection { id, pool_name, acquired_at, idle_since?, borrow_count }
PoolStatus { name, active, idle, pending, min, max, utilization_pct }
PoolMetrics { total_acquired, total_released, total_timeout, avg_acquire_ms, avg_usage_ms }
PoolConfig { min_idle, max_active, max_idle, acquire_timeout_ms, eviction_interval_ms }
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

### Error Taxonomy
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
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `connection_pool.<function>`.
* **Telemetry Metrics:**
```
gensense_connection_pool_active_current          gauge { pool_name }
  gensense_connection_pool_idle_current            gauge { pool_name }
  gensense_connection_pool_pending_current          gauge { pool_name }
  gensense_connection_pool_acquire_duration_ms      histogram { pool_name }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none -- infrastructure primitive)
* **Emits To:** (none)
* **Recommends:** circuit_breaker, health, telemetry
