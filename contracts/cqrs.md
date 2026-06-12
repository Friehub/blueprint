# Module Contract: `cqrs`

**Version:** 0.1.0

---

### `cqrs`
Command Query Responsibility Segregation with separate read/write models and projection synchronization.

**Functions**
```
executeCommand(command, context) → CommandResult
executeQuery(query, context) → QueryResult
defineCommandHandler(command_type, handler) → void
defineQueryHandler(query_type, handler) → void
synchronizeModel(projection_id) → SyncResult
defineReadModel(model_name, projection, options?) → ReadModel
getReadModel(model_name, filter?) → Record<string, any>[]
```

**Types**
```
Command { id, type, payload, metadata, expected_version? }
CommandResult { command_id, success: bool, result?, error?, new_version }
Query { id, type, filter, sort?, pagination? }
QueryResult { data, total, cursor, query_id }
ReadModel { name, projection_id, schema, status: syncing|active|stale, last_synced_at }
SyncResult { projection_id, events_processed, duration_ms, new_version }
CommandHandler { command_type, handler, validate(event), authorize(context) }
QueryHandler { query_type, handler, validate(filter) }
ReadModelField { name, type, indexed, source_event, source_field }
```

**Invariants**
- Commands must write to the write model synchronously -- the command response must reflect the persisted state
- Queries must read from the read model only -- they must not access the write model directly
- A read model must be built from events (via event sourcing) or from write-model projections -- direct queries against the write model for read purposes are a contract violation
- `synchronizeModel` must detect drift between the write model and the read model -- events not yet projected must be identified and processed
- The write model must enforce optimistic concurrency via `expected_version` -- a command with a stale version must fail with a `concurrency_conflict` error

**Dependencies:** event_sourcing

**Providers:** custom, PostgreSQL (write), MongoDB (read), DynamoDB (read)

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong` for writes; `eventual` for reads
* **Details:** The write model is strongly consistent. The read model is eventually consistent with configurable staleness.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for command-side events feeding projections.
* **Details:** Projection processing must be idempotent -- duplicate events must produce the same read model state.

### Worker Scaling
* **Policy:** Command handling and read model serving must be independently scalable.

### Multi-Region Behavior
* **Mode:** Write model is single-region; read models may be replicated to other regions.
* **Details:** A region serving reads must accept staleness up to the configured replication delay.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
executeCommand     → cqrs.command.executed       { command_type, result }
  synchronizeModel  → cqrs.model.synchronized      { projection_id, events_processed }
  executeQuery      → cqrs.query.executed          { query_type, result_count }
```

### Temporal Constraints
```
Read model staleness:
    default:        5 seconds
    on_expiry:      trigger synchronization; warn if stale reads are served

  Command timeout:
    default:        10 seconds
    on_expiry:      return timeout error; command state is indeterminate
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `cqrs.<function>`.
* **Telemetry Metrics:**
```
gensense_cqrs_commands_executed_total          { command_type, result }
  gensense_cqrs_queries_executed_total           { query_type }
  gensense_cqrs_read_model_lag_ms                 gauge { model_name }
  gensense_cqrs_synchronization_duration_ms        histogram { model_name }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** event_sourcing
* **Emits To:** events
* **Recommends:** audit_log (for command audit trail), reporting, storage
