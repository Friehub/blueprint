# Module Contract: `scheduled_tasks`

**Version:** 0.2.0

---

### `scheduled_tasks`
Time-based job scheduling with cron expressions and execution history.

**Functions**
```
createSchedule(name, cron_expression, action, options?) → Schedule
getSchedule(schedule_id) → Schedule
listSchedules(options?) → PaginatedResult<Schedule>
pauseSchedule(schedule_id) → void
resumeSchedule(schedule_id) → void
triggerManually(schedule_id) → Execution
updateSchedule(schedule_id, changes) → Schedule
deleteSchedule(schedule_id) → void
getExecutionHistory(schedule_id, options?) → PaginatedResult<Execution>
```

**Types**
```
Schedule { id, name, cron_expression, action, enabled, last_run_at?, next_run_at, created_at }
Execution { id, schedule_id, triggered_at, status: running|completed|failed, duration_ms?, error? }
ScheduleOptions { timezone?, max_concurrency?, retry_on_failure?, timeout? }
```

**Invariants**
- `pauseSchedule` must not cancel an in-flight execution -- it must prevent only future triggers
- A schedule must not create overlapping executions unless `max_concurrency > 1` is explicitly configured
- `triggerManually` must reset the next execution time based on the cron expression from the current time, not from the originally scheduled time

**Providers:** cron, BullMQ scheduler, Sidekiq-Cron, AWS EventBridge Scheduler, Kubernetes CronJob, custom

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Schedule metadata changes must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for scheduled execution triggers.
* **Details:** Duplicate triggers are possible under failover and must be deduplicated by execution identity.

### Worker Scaling
* **Policy:** Schedule evaluation (cron tick) and execution worker pools must be independently scalable.

### Multi-Region Behavior
* **Mode:** Single-region or active/passive; active/active requires distributed locking to prevent duplicate triggers.
* **Details:** At most one region should evaluate cron ticks to prevent duplicate execution.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If execution backlog grows beyond the configured timeout, the module must skip expired triggers rather than cascade delays.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
triggerManually   → schedule.triggered         { schedule_id, name, execution_id }
  Execution start  → schedule.execution.started  { schedule_id, execution_id }
  Execution end    → schedule.execution.completed { schedule_id, execution_id, duration_ms }
                 OR schedule.execution.failed    { schedule_id, execution_id, error }
```

### Temporal Constraints
```
Cron evaluation:
    resolution:     1 minute  (standard cron granularity)
    jitter:         +0-30 seconds  (prevent thundering herd on exact minute boundaries)

  Execution timeout:
    default:        30 minutes
    on_expiry:      mark execution as failed with timeout reason

  Missed catch-up:
    max_catch_up:   last 3 missed executions; older missed triggers are skipped
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `scheduled_tasks.<function>`.
* **Telemetry Metrics:**
```
blueprint_scheduled_tasks_triggers_total         { schedule_id, status }
  blueprint_scheduled_tasks_execution_duration_ms  histogram { schedule_id }
  blueprint_scheduled_tasks_lag_ms                  gauge { schedule_id }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** jobs
* **Emits To:** events
* **Recommends:** audit_log
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `triggered_at DESC` on `getExecutionHistory`.
