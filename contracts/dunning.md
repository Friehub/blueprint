# Module Contract: `dunning`

**Version:** 0.1.0

---

### `dunning`
Failed payment retry logic with escalating intervals and final notification.

**Functions**
```
createDunningCycle(payment_id: any, config?: DunningConfig) → DunningCycle
attemptRetry(cycle_id: any) → DunningAttempt
updateCycle(cycle_id: any, updates: any) → DunningCycle
pauseCycle(cycle_id: any, reason?: string) → DunningCycle
resumeCycle(cycle_id: any) → DunningCycle
cancelCycle(cycle_id: any, reason?: string) → DunningCycle
getCycleStatus(cycle_id: any) → DunningCycle
listAttempts(cycle_id: any) → DunningAttempt[]
```

**Types**
```
DunningConfig { max_retries?: int, initial_interval_seconds?: int, backoff_factor?: int, notify_on?: attempt[] }
DunningCycle { id, payment_id, status: active | paused | completed | cancelled | failed, attempt_count, max_retries, next_attempt_at, created_at, updated_at, reason? }
DunningAttempt { id, cycle_id, attempt_number, attempted_at, result: success | failed | skipped, response_code?, error_message?, latency_ms }
```

**Invariants**
- Maximum retries must not exceed 5; cycles with `max_retries > 5` must be capped
- Retry interval must increase exponentially: `interval = initial_interval * (backoff_factor ^ attempt_number)`
- Final attempt must send a notification regardless of success or failure
- `pauseCycle` must prevent further retries until `resumeCycle` is called
- Consecutive failed attempts must not decrease the retry interval
- `attempt_count` must never exceed `max_retries`; further calls to `attemptRetry` return `MAX_RETRIES_REACHED`
- Each attempt must have a unique `attempt_number` within a cycle starting at 1

**Providers:** built-in scheduler, Stripe dunning, custom retry queue, Bull/BullMQ job

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** Retry scheduling may lag by up to 10 seconds under load; attempt execution is strongly consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once`
* **Details:** Retry attempts may be duplicated; idempotency key prevents double charge

### Worker Scaling
* **Policy:** Retry workers must be horizontally scalable; each cycle is processed independently

### Multi-Region Behavior
* **Mode:** Dunning cycles are associated with the payment's home region
* **Details:** Retry scheduling is region-local; cross-region payment retries require coordination

### Backpressure
* If the payment provider is saturated, dunning must back off and extend the retry interval rather than hammering the provider

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).
* Dunning-specific errors: `MAX_RETRIES_REACHED`, `CYCLE_PAUSED`, `CYCLE_COMPLETED`, `CYCLE_CANCELLED`, `RETRY_INTERVAL_NOT_ELAPSED`

### Idempotency Requirements
* **Standard:** `attemptRetry` accepts an optional `idempotency_key` to prevent duplicate charges.
* **Required Functions:**
  - `attemptRetry(cycle_id, idempotency_key?)`

### Event Emission
```
createDunningCycle   → dunning.cycle.created            { cycle_id, payment_id, max_retries }
attemptRetry         → dunning.attempt.scheduled         { cycle_id, attempt_number, scheduled_at }
attemptRetry         → dunning.attempt.completed         { cycle_id, attempt_number, result, latency_ms }
attemptRetry         → dunning.attempt.failed_backoff    { cycle_id, attempt_number, next_attempt_at }
pauseCycle           → dunning.cycle.paused              { cycle_id, reason }
resumeCycle          → dunning.cycle.resumed             { cycle_id }
cancelCycle          → dunning.cycle.cancelled           { cycle_id, reason }
updateCycle          → dunning.cycle.updated             { cycle_id, changes }
```

### Temporal Constraints
```
Retry timing:
    initial_interval:   1 hour
    backoff_factor:     2x
    max_interval:       48 hours
    on_max_retries:     mark cycle as failed; send final notification

Cycle lifecycle:
    max_duration:       14 days (from creation)
    on_expire:          cancel cycle; notify stakeholder
```

### Storage Model
* **Model:** Relational storage for cycle and attempt records with a job queue for scheduling
* **Details:** Cycles are stored in PostgreSQL; retry scheduling uses a job queue (Bull/BullMQ or equivalent)

### Observability
* **Tracing Spans:** Every dunning operation creates a span. Span names follow `dunning.<function>`.
* **Telemetry Metrics:**
```
blueprint_dunning_operation_total               counter { function, result }
blueprint_dunning_operation_duration_ms         histogram { function }
blueprint_dunning_cycles_active                gauge { status }
blueprint_dunning_attempts_total               counter { result }
blueprint_dunning_retry_latency_ms             histogram
blueprint_dunning_errors_total                 counter { function, error_code }
blueprint_dunning_notifications_sent_total     counter { type }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** payment, notification, idempotency_key_standard
* **Emits To:** events, job queue
* **Recommends:** audit_log

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE dunning_cycles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id        UUID NOT NULL,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled', 'failed')),
  attempt_count     INT NOT NULL DEFAULT 0,
  max_retries       INT NOT NULL DEFAULT 5,
  initial_interval_seconds INT NOT NULL DEFAULT 3600,
  backoff_factor    INT NOT NULL DEFAULT 2,
  next_attempt_at   TIMESTAMPTZ,
  reason            TEXT,
  config            JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dunning_cycles_status ON dunning_cycles(status, next_attempt_at) WHERE status = 'active';
CREATE INDEX idx_dunning_cycles_payment ON dunning_cycles(payment_id);

CREATE TABLE dunning_attempts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id          UUID NOT NULL REFERENCES dunning_cycles(id) ON DELETE CASCADE,
  attempt_number    INT NOT NULL,
  attempted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  result            TEXT NOT NULL CHECK (result IN ('success', 'failed', 'skipped')),
  response_code     TEXT,
  error_message     TEXT,
  latency_ms        INT,
  idempotency_key   TEXT,
  UNIQUE (cycle_id, attempt_number)
);

CREATE INDEX idx_dunning_attempts_cycle ON dunning_attempts(cycle_id, attempt_number);
```

### Breaking Change Policy
- Adding new retry schedule parameters is backward-compatible.
- Changing the backoff algorithm requires a MAJOR version bump.
- Increasing max_retries above 5 requires a MAJOR version bump.
- Adding new cycle statuses is backward-compatible; removing statuses requires a MAJOR version bump.
- Changing the default retry interval requires a MINOR version bump.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Payment provider unavailable | Downstream gateway returns 503 | Backoff and retry; mark attempt as failed with ProviderError |
| Idempotency key collision | Attempt retried with same key | Return cached success result; do not charge again |
| Cycle stuck in active | Worker crash before scheduling | Background reaper detects cycles with no attempts > interval; re-schedule |
| Max retries exceeded without resolution | All 5 attempts failed | Mark cycle failed; trigger final escalation notification |
| Manual payment received during dunning | Customer pays invoice while cycle is active | Cancel cycle immediately; log reconciliation event |
