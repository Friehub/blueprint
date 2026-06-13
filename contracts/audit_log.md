# Module Contract: `audit_log`

**Version:** 0.2.0

---

### `audit_log`
Immutable record of system events for compliance and debugging.

**Functions**
```
recordEvent(event) → AuditEvent
queryEvents(filters, options?) → PaginatedResult<AuditEvent>
getEventsByActor(actor_id, options?) → PaginatedResult<AuditEvent>
getEventsByResource(resource_type, resource_id) → AuditEvent[]
exportAuditLog(filters, format) → ExportJob
getEvent(event_id) → AuditEvent
verifyChain(from, to) → ChainVerificationReport
```

**Types**
```
AuditEvent { id, actor, action, resource, changes?, ip_address?, metadata, created_at, chain_hash, previous_hash? }
AuditActor { type: user | system | api_key, id, name? }
AuditResource { type, id, name? }
ExportFormat = json | csv
ChainVerificationReport { from, to, total_events, chain_intact: bool, breaks: ChainBreak[] }
ChainBreak { index, event_id, expected_previous_hash, actual_previous_hash, reason }
```

**Invariants**
- Audit events must never be deleted or modified after creation
- `recordEvent` must be non-blocking -- it must not add latency to the calling operation
- Each new audit event must include a `chain_hash` computed from the event content concatenated with the `chain_hash` of the preceding event, forming an immutable hash chain
- `verifyChain` must detect any break in the chain: a missing event, a modified event hash, or an inconsistency between the stored `previous_hash` and the actual hash of the preceding event. Any break must be surfaced immediately in the `ChainVerificationReport`
- `recordEvent` must reject events with a `chain_hash` that does not match the computed hash of `(event_content + previous_hash)`, returning `CHAIN_HASH_MISMATCH`
- `queryEvents` must return events in descending `created_at` order; results must be internally consistent within a single page
- An audit event's `actor` and `resource` fields must be non-null -- every event must identify both who performed the action and what it was performed on

**Providers:** custom append-only table, Axiom, Datadog, custom event stream

---

## Part IV -- Commerce

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** Query results may lag by up to 5 seconds; `recordEvent` is durable

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for ingestion into downstream sinks.
* **Details:** Duplicate records must not violate append-only semantics.

### Worker Scaling
* **Policy:** Record ingestion and query/export workloads must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether audit ingestion is single-region or active/passive.
* **Details:** Duplicate cross-region ingestion must be deduplicated by event identity when possible.

### Idempotency Requirements
* **Standard:** All state-mutating functions accept an optional `idempotency_key: string` parameter. Keys must be retained for at least 24 hours.
* **Required Functions:**
  - `recordEvent(event, idempotency_key?)`

### Backpressure
* If ingestion or export is saturated, the module must defer or reject predictably rather than dropping events silently.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
recordEvent       → audit_log.event.recorded        { event_id, actor_id, action, resource_type }
exportAuditLog    → audit_log.export.started         { job_id, format }
verifyChain       → audit_log.chain.verified         { from, to, chain_intact, breaks }
                 OR audit_log.chain.break_detected   { from, to, break_count }
```

Note: `audit_log` events are meta-events about the audit system itself. The audit events recorded via `recordEvent` are not re-emitted as domain events -- they are stored in the append-only table and queried via `queryEvents`.

### Temporal Constraints
```
Audit retention:
    retention:         configurable per compliance policy
    on_expiry:         only purge when policy explicitly allows it
```

### Storage Model
* **Model:** Append-only durable audit store.
* **Details:** Records must be immutable after creation and queryable for the configured retention window.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `audit_log.<function>`.
* **Telemetry Metrics:**
```
blueprint_audit_log_operation_total              counter { function, result }
blueprint_audit_log_operation_duration_ms        histogram { function }
blueprint_audit_log_errors_total                 counter { function, error_code }
blueprint_audit_log_events_recorded_total         counter { action }
blueprint_audit_log_chain_breaks_total            counter
blueprint_audit_log_export_jobs_total             counter { format, status }
blueprint_audit_log_ingestion_lag_ms             gauge
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none -- must be dependency-free to avoid circular dependencies)
* **Emits To:** events
* **Recommends:** (none)
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `created_at DESC` on `queryEvents`.

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE audit_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type      TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'api_key')),
  actor_id        TEXT NOT NULL,
  actor_name      TEXT,
  action          TEXT NOT NULL,
  resource_type   TEXT NOT NULL,
  resource_id     TEXT NOT NULL,
  resource_name   TEXT,
  changes         JSONB,
  ip_address      INET,
  metadata        JSONB DEFAULT '{}',
  chain_hash      TEXT NOT NULL,
  previous_hash   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_events_actor ON audit_events(actor_type, actor_id, created_at DESC);
CREATE INDEX idx_audit_events_resource ON audit_events(resource_type, resource_id, created_at DESC);
CREATE INDEX idx_audit_events_action ON audit_events(action, created_at DESC);
CREATE INDEX idx_audit_events_created ON audit_events(created_at DESC);

-- Chain verification support
CREATE INDEX idx_audit_events_chain ON audit_events(created_at) INCLUDE (id, chain_hash, previous_hash);

CREATE TABLE audit_chain_verification_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_created_at   TIMESTAMPTZ NOT NULL,
  to_created_at     TIMESTAMPTZ NOT NULL,
  chain_intact      BOOLEAN NOT NULL,
  total_events      INTEGER NOT NULL,
  breaks            JSONB DEFAULT '[]',
  verified_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Storage Model
* **Model:** Append-only durable audit store with hash chain integrity.
* **Details:** Records must be immutable after creation and queryable for the configured retention window. The hash chain uses SHA-256 over `(event_content_json || previous_hash)`. The `previous_hash` of the first event in the chain is `NULL`.

### Breaking Change Policy
- Adding new actor types or resource fields is additive and backward-compatible.
- Removing or renaming an existing actor type requires a MAJOR version bump.
- Changing the hash chain algorithm (SHA-256 to another) requires a MAJOR version bump and a migration plan for existing chains.
- Adding new required fields to the event payload requires a MAJOR version bump.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Chain hash mismatch | Incorrect previous_hash supplied | Reject recordEvent with CHAIN_HASH_MISMATCH; log for operator review |
| Hash chain break detected | Event deleted or modified out of band | Surface in ChainVerificationReport; alert security team |
| Audit event loss during ingestion | Write failure under load | Buffer in durable queue; retry with idempotency key; never drop |
| Query timeout on large range | Unindexed filter combination | Restrict query filters to indexed columns; use cursor pagination |
| Export produces inconsistent snapshot | Concurrent writes during export | Use repeatable read isolation for export queries |
