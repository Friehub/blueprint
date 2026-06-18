# Module Contract: `background_jobs`

**Version:** 0.1.0

---

### `background_jobs`
Worker lifecycle management for asynchronous job processing with retries, dead-letter queues, and idempotent execution.

**Functions**
```
enqueueJob(job: any) → Job
getJob(job_id: any) → Job
listJobs(filters: any, options?: any) → PaginatedResult<Job>
cancelJob(job_id: any) → Job
retryJob(job_id: any) → Job
getJobStatus(job_id: any) → JobStatus
getDeadLetterJobs(filters: any, options?: any) → PaginatedResult<DeadLetterJob>
retryDeadLetterJob(job_id: any) → Job
```

**Types**
```
Job { id, name, payload, status: JobStatus, priority?, idempotency_key, attempts, max_attempts, scheduled_at?, started_at?, completed_at?, failed_at?, error?, created_at, updated_at }
JobStatus = queued | running | failed | completed | cancelled
DeadLetterJob { id, original_job_id, name, payload, error, failed_at, moved_to_dlq_at, retry_count }
```

**Invariants**
- Job must not be silently dropped; every enqueued job must be observable via `listJobs` or `getJob`
- Dead letter TTL must be configurable; expired dead letter jobs may be purged automatically
- Each job must have a unique idempotency key; re-enqueuing with the same key must return the existing job
- A job in `running` state must not be retried or cancelled until a timeout threshold is exceeded
- `max_attempts` must be a positive integer; exceeding it moves the job to the dead letter queue

**Dependencies**
- queues
- audit_log

**System-Level Integrations**
- BullMQ
- SQS
- RabbitMQ

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `at_least_once`
* **Details:** Jobs must survive broker restarts; in-memory loss is unacceptable.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for job delivery to workers.
* **Details:** Duplicate execution must be prevented via idempotency keys.

### Worker Scaling
* **Policy:** Worker pools must be horizontally scalable; job distribution must use consistent hashing or a shared queue.

### Multi-Region Behavior
* **Mode:** Active/passive with regional queue failover.
* **Details:** Cross-region job duplication must be deduplicated by idempotency key.

### Idempotency Requirements
* **Standard:** All state-mutating functions accept an optional `idempotency_key: string` parameter. Keys must be retained for at least 24 hours.
* **Required Functions:**
  - `enqueueJob(job, idempotency_key?)`
  - `retryJob(job_id, idempotency_key?)`
  - `retryDeadLetterJob(job_id, idempotency_key?)`

### Backpressure
* If all worker queues are saturated, `enqueueJob` must either reject with a rate limit error or block until capacity is available.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
enqueueJob              → background_jobs.job.enqueued          { job_id, name, priority }
cancelJob               → background_jobs.job.cancelled         { job_id, name }
retryJob                → background_jobs.job.retried           { job_id, name, attempt }
getDeadLetterJobs       → background_jobs.dead_letter.listed    { count }
retryDeadLetterJob      → background_jobs.dead_letter.retried   { job_id, original_job_id }
```

### Temporal Constraints
```
Dead letter retention:
    ttl:                  configurable (default 7 days)
    on_expiry:            purge after TTL
```

### Storage Model
* **Model:** Durable queue backed by a persistent store.
* **Details:** Job metadata and state transitions must survive process restarts.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `background_jobs.<function>`.
* **Telemetry Metrics:**
```
blueprint_background_jobs_enqueued_total          counter { queue, priority }
blueprint_background_jobs_completed_total         counter { queue }
blueprint_background_jobs_failed_total            counter { queue, error_code }
blueprint_background_jobs_cancelled_total         counter { queue }
blueprint_background_jobs_retried_total           counter { queue }
blueprint_background_jobs_dead_letter_total       counter { queue }
blueprint_background_jobs_queue_depth             gauge { queue }
blueprint_background_jobs_processing_duration_ms  histogram { queue }
```

### Module Dependencies
* **Depends On:** queues, audit_log
* **Emits To:** events
* **Recommends:** (none)
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `created_at DESC` on `listJobs` and `getDeadLetterJobs`.

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE background_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  payload         JSONB NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('queued', 'running', 'failed', 'completed', 'cancelled')),
  priority        INTEGER DEFAULT 0,
  idempotency_key TEXT UNIQUE,
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 3,
  scheduled_at    TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_background_jobs_status ON background_jobs(status, created_at DESC);
CREATE INDEX idx_background_jobs_name ON background_jobs(name, created_at DESC);
CREATE INDEX idx_background_jobs_idempotency ON background_jobs(idempotency_key);
CREATE INDEX idx_background_jobs_scheduled ON background_jobs(scheduled_at) WHERE status = 'queued';

CREATE TABLE background_dead_letter_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_job_id UUID NOT NULL REFERENCES background_jobs(id),
  name            TEXT NOT NULL,
  payload         JSONB NOT NULL,
  error           TEXT NOT NULL,
  failed_at       TIMESTAMPTZ NOT NULL,
  moved_to_dlq_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  retry_count     INTEGER NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days'
);

CREATE INDEX idx_dlq_expires ON background_dead_letter_jobs(expires_at) WHERE retry_count = 0;
CREATE INDEX idx_dlq_original ON background_dead_letter_jobs(original_job_id);
```

### Breaking Change Policy
- Adding new job statuses is additive and backward-compatible.
- Removing or renaming an existing status requires a MAJOR version bump.
- Changing the dead letter TTL default requires a MINOR version bump.
- Adding new required fields to the job payload requires a MAJOR version bump.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Job silently dropped | Enqueue failure under load | Return error to caller; never swallow |
| Duplicate execution | Missing idempotency check | Enforce idempotency_key uniqueness at DB level |
| Dead letter overflow | Unhandled failures piling up | Alert on DLQ depth; provide retryDeadLetterJob |
| Stuck running jobs | Worker crash without status update | Use heartbeat timeout to auto-fail stuck jobs |
| Queue backpressure | All consumers saturated | Reject enqueue with RateLimited; log for operator |
