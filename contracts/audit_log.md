# Module Contract: `audit_log`

**Version:** 0.1.0

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
* None explicitly defined. Custom events must use the canonical domain envelope.

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
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none -- must be dependency-free to avoid circular dependencies)
* **Emits To:** (none)
* **Recommends:** (none)
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `created_at DESC` on `queryEvents`.
