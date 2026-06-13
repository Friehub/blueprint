# Module Contract: `cqrs`

**Version:** 0.2.0

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
### Module-Specific Errors
```
executeCommand:
    concurrency_conflict:      Expected version does not match write model version | retry with latest version
    command_not_found:         No handler registered for this command type | verify command_type
    handler_rejected:          Command handler rejected the command | check error details
    command_timeout:           Command execution exceeded timeout | command state is indeterminate

  executeQuery:
    query_not_found:           No handler registered for this query type | verify query_type

  synchronizeModel:
    projection_not_found:      No projection found for the given projection_id | verify projection_id
    drift_detected:            Write model and read model are out of sync beyond acceptable threshold | trigger full rebuild

  defineReadModel:
    model_already_exists:      Read model with this name already exists | use update or different name
```

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
blueprint_cqrs_commands_executed_total          { command_type, result }
  blueprint_cqrs_queries_executed_total           { query_type }
  blueprint_cqrs_read_model_lag_ms                 gauge { model_name }
  blueprint_cqrs_synchronization_duration_ms        histogram { model_name }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Storage Model
* **Model:** Strongly consistent write model (command side); eventually consistent read model (query side).
* **Details:** The write model is backed by an ACID-compliant store with optimistic concurrency. The read model is a denormalized projection built asynchronously from the event stream.

### Database Schema

#### PostgreSQL (Write Model)
```sql
CREATE TABLE cqrs_command_store (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_type    TEXT NOT NULL,
  payload         JSONB NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  expected_version INT,
  result          JSONB,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cqrs_read_models (
  name            TEXT PRIMARY KEY,
  projection_id   TEXT NOT NULL,
  schema_def      JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'syncing' CHECK (status IN ('syncing', 'active', 'stale')),
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cqrs_projection_offsets (
  projection_id   TEXT PRIMARY KEY,
  last_event_id   UUID NOT NULL,
  last_version    BIGINT NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Module Dependencies
* **Depends On:** event_sourcing
* **Emits To:** events
* **Recommends:** audit_log (for command audit trail), reporting, storage
