# Module Contract: `distributed_lock`

**Version:** 0.1.0

---

### `distributed_lock`
Cross-instance mutual exclusion with fencing tokens and lease management.

**Functions**
```
acquire(lock_name, ttl) → Lock
tryAcquire(lock_name, ttl) → Lock?
release(lock_token) → void
extend(lock_token, ttl) → void
getLockStatus(lock_name) → LockStatus?
forceRelease(lock_name) → void
```

**Types**
```
Lock { token, name, holder_id, acquired_at, expires_at, fencing_token }
LockStatus { name, holder_id, acquired_at, expires_at, is_expired }
```

**Invariants**
- `acquire` must block until the lock is obtained or a configurable timeout is reached
- `tryAcquire` must return immediately -- it must not block even if the lock is held
- A lock acquired with fencing token `N` must guarantee that no other holder held the same lock with token `>= N`
- `release` with a stale or invalid token must be a no-op rather than releasing someone else's lock

**Providers:** Redis (Redlock), ZooKeeper, etcd, PostgreSQL (advisory locks), DynamoDB

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Lock state must be strongly consistent; a lock must not be granted to two holders simultaneously

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once` for lock lifecycle events.
* **Details:** Duplicate acquire events must be safe because the lock state machine converges.

### Worker Scaling
* **Policy:** Lock acquisition must be independently scalable per lock name (partitioned by lock key).

### Multi-Region Behavior
* **Mode:** Locking must be single-region unless the deployment explicitly documents a multi-region consensus mechanism.
* **Details:** Cross-region locking adds significant latency and failure modes; prefer regional partitioning.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If the lock backend is saturated, `acquire` must fail with a timeout error rather than queuing indefinitely.

### Algorithm
* **Recommended:** Redlock algorithm for distributed mutual exclusion with fencing tokens. ZooKeeper/etcd for strongly consistent lock services. PostgreSQL advisory locks for single-database deployments.
* **Details:** Redlock uses multiple independent Redis instances for quorum-based locking. ZooKeeper/etcd provide linearizable operations with watches for lock notification. PostgreSQL advisory locks are simpler but limited to single database. Tradeoff: Redlock is fast but has caveats with clock skew; ZooKeeper/etcd are strongly consistent but add complexity; PostgreSQL locks are simple but not distributed.
* **Atomicity:** Lock acquisition must be atomic with fencing token generation. A lock must not be granted to two holders simultaneously. Fencing tokens must monotonically increase to prevent stale lock operations.

### Error Taxonomy
### Module-Specific Errors
```
acquire / tryAcquire:
    lock_timeout:           Lock could not be acquired within the timeout | retry with backoff

  release:
    invalid_token:          Token is stale, already released, or never issued | no action required
    not_holder:             Caller does not hold this lock | check token and holder_id
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
acquire          → lock.acquired              { lock_name, holder_id, fencing_token }
  release          → lock.released              { lock_name, holder_id }
  extend           → lock.extended              { lock_name, new_expires_at }
  forceRelease     → lock.force_released         { lock_name, released_by }
```

### Temporal Constraints
```
Lock TTL:
    default:        30 seconds
    maximum:        5 minutes  (prevents stale locks from blocking indefinitely)
    on_expiry:      automatically released; holder must extend before expiry

  Acquire timeout:
    default:        10 seconds
    on_expiry:      return lock_timeout
```

### Storage Model
* **Model:** Ephemeral lock state with fencing token monotonicity enforcement.
* **Details:** Lock state may be stored in Redis, ZooKeeper, etcd, or PostgreSQL advisory locks. Fencing tokens must be stored durably enough to guarantee monotonic increase across restarts.

### Database Schema (PostgreSQL advisory lock variant)

```sql
CREATE TABLE distributed_locks (
  lock_name         TEXT PRIMARY KEY,
  holder_id         TEXT NOT NULL,
  token             TEXT NOT NULL,
  fencing_token     BIGINT NOT NULL,
  acquired_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL,
  version           INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_locks_expires ON distributed_locks(expires_at)
  WHERE expires_at < now();

CREATE TABLE distributed_lock_fencing (
  lock_name         TEXT PRIMARY KEY,
  last_token        BIGINT NOT NULL DEFAULT 0
);
```

### Failure Modes & Breaking Change Policy

| Failure Mode | Detection | Mitigation |
|---|---|---|
| Clock skew between lock nodes | Fencing token ordering violated | Use monotonic fencing tokens; reject stale tokens |
| Lock backend unavailable | `lock_timeout` on acquire | Circuit-break after N consecutive failures; fall back to local pessimistic lock |
| Split-brain across regions | Two holders believe they hold the same lock | Single-region locking; multi-region requires explicit consensus |
| Stale lock holder not released | Lock expires at TTL | Auto-release on expiry; holder must extend before deadline |

**Breaking Changes:** Changing the fencing token format or lock backend requires all holders to release locks cleanly before migration. `ttl` maximum reduction is breaking if existing holders rely on longer leases. Adding a new required parameter to `acquire` is breaking.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `distributed_lock.<function>`.
* **Telemetry Metrics:**
```
gensense_distributed_lock_acquire_duration_ms    histogram { lock_name, result }
  gensense_distributed_lock_contention_total       { lock_name }
  gensense_distributed_lock_holders_current        gauge { lock_name }
  gensense_distributed_lock_fencing_gap            gauge { lock_name }
  gensense_distributed_lock_expiry_reclaim_total   { lock_name }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none -- infrastructure primitive)
* **Emits To:** events
* **Recommends:** circuit_breaker, health, telemetry
