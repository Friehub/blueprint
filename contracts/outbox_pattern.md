# Module Contract: `outbox_pattern`

**Version:** 0.1.0

---

### `outbox_pattern`
Transactional outbox for reliable event publishing, ensuring events are written atomically with state changes and published without data loss.

**Functions**
```
publishEvent(event: any) → OutboxMessage
processOutbox(options?: any) → number
requeueFailed(filters?: any) → number
getPendingCount() → number
```

**Types**
```
OutboxMessage { id, aggregate_type, aggregate_id, event_type, payload, status: OutboxStatus, attempt_count, max_attempts, created_at, published_at?, last_error? }
OutboxStatus = pending | published | failed
```

**Invariants**
- Event must be written in same DB transaction as state change; outbox insert must succeed or the entire transaction rolls back
- Reader must not modify; `processOutbox` must be read-only with respect to event content (status updates are metadata only)
- Published events must be marked not deleted; events must transition to `published` status, never be removed
- Requeue of failed events must respect `max_attempts`; surpassing it keeps the event in `failed` status

**Dependencies**
- event_bus
- audit_log

**System-Level Integrations**
- Redis
- Postgres
- Kafka

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong` for insert; `at_least_once` for publication.
* **Details:** The outbox insert is part of the application transaction. Publishing may lag but must eventually complete.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for event publication.
* **Details:** A published event may be published more than once; consumers must handle deduplication.

### Worker Scaling
* **Policy:** Outbox processors must be horizontally scalable with leader election or partition assignment to avoid duplicate processing.

### Multi-Region Behavior
* **Mode:** Active/passive with regional outbox tables.
* **Details:** Each region processes its own outbox; cross-region event ordering is not guaranteed.

### Idempotency Requirements
* **Standard:** All state-mutating functions accept an optional `idempotency_key: string` parameter. Keys must be retained for at least 24 hours.
* **Required Functions:**
  - `publishEvent(event, idempotency_key?)`

### Backpressure
* If publication to the event bus is saturated, `processOutbox` must back off exponentially rather than dropping events.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
publishEvent          → outbox_pattern.event.published          { message_id, event_type, aggregate_id }
processOutbox         → outbox_pattern.outbox.processed         { published_count, failed_count }
requeueFailed         → outbox_pattern.failed.requeued          { requeued_count }
getPendingCount       → outbox_pattern.pending.counted          { count }
```

### Temporal Constraints
```
Outbox retention:
    retention:            configurable (default 30 days)
    on_expiry:            soft-delete or archive after retention
```

### Storage Model
* **Model:** Relational table within the application database.
* **Details:** The outbox table shares the same transaction scope as the application data. No external store is required.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `outbox_pattern.<function>`.
* **Telemetry Metrics:**
```
blueprint_outbox_pattern_published_total            counter { event_type }
blueprint_outbox_pattern_failed_total               counter { event_type, error_code }
blueprint_outbox_pattern_pending_count              gauge
blueprint_outbox_pattern_processing_duration_ms     histogram
blueprint_outbox_pattern_lag_ms                     gauge { event_type }
```

### Module Dependencies
* **Depends On:** event_bus, audit_log
* **Emits To:** events
* **Recommends:** idempotency_store
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `created_at ASC` on `processOutbox` to maintain FIFO ordering.

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE outbox_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type  TEXT NOT NULL,
  aggregate_id    TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed')),
  attempt_count   INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 3,
  idempotency_key TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at    TIMESTAMPTZ,
  last_error      TEXT
);

CREATE INDEX idx_outbox_status ON outbox_messages(status, created_at ASC) WHERE status = 'pending';
CREATE INDEX idx_outbox_event_type ON outbox_messages(event_type, created_at DESC);
CREATE INDEX idx_outbox_aggregate ON outbox_messages(aggregate_type, aggregate_id, created_at DESC);
CREATE INDEX idx_outbox_idempotency ON outbox_messages(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_outbox_failed ON outbox_messages(status, attempt_count ASC) WHERE status = 'failed';
```

### Breaking Change Policy
- Adding new event types or statuses is additive and backward-compatible.
- Removing or renaming an existing status requires a MAJOR version bump.
- Changing the processing order from FIFO to priority-based requires a MAJOR version bump.
- Adding new required fields to the outbox message payload requires a MAJOR version bump.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Event not published | processOutbox skipped or crashed | Periodic processor with backoff; alert on pending backlog |
| Duplicate publication | At-least-once delivery | Consumer-side deduplication via idempotency key |
| Outbox table grows unbounded | Missing cleanup job | Schedule periodic archive or delete of published records |
| Failed event never requeued | max_attempts exhausted without alert | Monitor failed count; alert on threshold |
| Transaction rollback loses event | Outbox insert not in same transaction | Enforce same DB connection and transaction scope |
