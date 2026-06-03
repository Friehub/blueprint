# Module Contract: `queues`

**Version:** 0.1.0

---

### `queues`
Async job processing and task scheduling.

**Functions**
```
enqueue(queue_name, payload, options?) → Job
enqueueBulk(queue_name, payloads) → Job[]
scheduleJob(queue_name, payload, run_at) → Job
cancelJob(job_id) → void
getJob(job_id) → Job
getJobStatus(job_id) → JobStatus
retryJob(job_id) → Job
getQueueStats(queue_name) → QueueStats
purgeQueue(queue_name) → void
```

**Types**
```
Job { id, queue_name, payload, status, attempts, max_attempts, run_at, completed_at? }
JobStatus = waiting | active | completed | failed | cancelled | delayed
QueueStats { waiting, active, completed, failed, delayed }
JobOptions { delay?, priority?, max_attempts?, backoff? }
```

**Invariants**
- A failed job must not be lost -- it must transition to `failed` state with the error recorded
- `cancelJob` on an active job must be a best-effort operation, not a guarantee

**Providers:** BullMQ, Inngest, Quirrel, AWS SQS, Sidekiq

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `causal`
* **Details:** A job enqueued after another must not execute before it in the same queue

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once`
* **Details:** Consumers must be idempotent because redelivery can occur after worker restarts or broker failover.

### Worker Scaling
* **Policy:** Worker concurrency must be configurable per queue.
* **Details:** CPU-bound and IO-bound queues should not share the same concurrency profile unless the deployment explicitly documents it.

### Multi-Region Behavior
* **Mode:** Single-region, active/passive, or active/active must be declared by the deployment.
* **Details:** Any multi-region deployment must preserve job durability and deduplication across failover.

### Idempotency Requirements
* **Standard:** All state-mutating functions accept an optional `idempotency_key: string` parameter. Keys must be retained for at least 24 hours.
* **Required Functions:**
  - `enqueue(queue_name, payload, options?, idempotency_key?)`

### Error Taxonomy
### Module-Specific Errors
```
enqueue:
    queue_full:                Queue has reached capacity limit | return retry_after
    payload_too_large:         Payload exceeds maximum size | split or compress payload

  retryJob:
    max_attempts_reached:      Job has exhausted retry budget | move to dead letter queue
    job_not_retryable:         Job type does not permit manual retry | reject
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Dead-Letter Handling
* Jobs that exceed `max_attempts` must transition to a dead-letter queue or dead-letter store.
* Dead-letter records must retain the original payload, error reason, attempt count, and first/last failure timestamps.
* Poison jobs must be quarantined and can only be replayed with explicit operator action.

### Temporal Constraints
```
Job (waiting):
    max_wait:       configurable per queue, default 24 hours
    on_expiry:      transition to failed with reason "max_wait_exceeded"

  Job retry backoff:
    strategy:       exponential with jitter
    initial_delay:  30 seconds
    max_delay:      1 hour
    max_attempts:   configurable, default 3

  Dead-letter retention:
    max_duration:   configurable per queue, minimum 7 days for failed jobs
    on_expiry:      eligible for purge after operator review window

  Payload size:
    max_size:       256 KiB default unless a queue explicitly overrides it
    on_exceed:      reject with payload_too_large
```

### Backpressure
* When queue capacity is reached, the adapter must reject or defer work predictably; it must not accept unbounded work silently.
* `enqueue` should return a retryable response when the queue is full.

### Storage Model
* **Model:** Broker-backed durable queue with an operational dead-letter store.
* **Details:** The implementation may use Redis, SQS, RabbitMQ, Kafka, or a managed abstraction, but failed jobs must remain queryable until retention expiry.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `queues.<function>`.
* **Telemetry Metrics:**
```
gensense_queues_depth                       gauge { queue_name, status }
  gensense_queues_job_duration_ms             histogram { queue_name }
  gensense_queues_dead_letter_total           { queue_name }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none -- infrastructure primitive)
* **Emits To:** (none)
* **Recommends:** audit_log
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `run_at ASC` (next to execute first) on `getJobStatus`.
