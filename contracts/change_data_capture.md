# Module Contract: `change_data_capture`

**Version:** 0.1.0

---

### `change_data_capture`
Database change streaming with operation filtering, schema evolution, and replay.

**Functions**
```
configureCDC(table, config) → CDCStream
getCDCStream(stream_id) → CDCStream
listCDCStreams() → CDCStream[]
startStream(stream_id) → void
stopStream(stream_id) → void
getChanges(stream_id, options?) → ChangeEvent[]
filterOperations(stream_id, operations) → void
getStreamLag(stream_id) → LagInfo
replayChanges(stream_id, from_lsn) → ReplayResult
handleSchemaChange(stream_id, schema_change) → void
```

**Types**
```
CDCStream { id, table, source_type, status: stopped|running|failed, lsn, slot_name?, created_at }
ChangeEvent { lsn, operation: insert|update|delete|truncate, table, row_data: Record<string, any>, old_data?: Record<string, any>, timestamp, transaction_id }
LagInfo { stream_id, current_lsn, latest_source_lsn, lag_bytes, lag_ms, estimated_catchup_s }
ReplayResult { stream_id, events_replayed, from_lsn, to_lsn, duration_ms }
SchemaChange { table, old_schema, new_schema, change_type: add_column|drop_column|alter_column|rename_table, applied_at }
CDCConfig { publication?, slot?, batch_size?, poll_interval?, include_old?, include_transaction?,
            heartbeat_interval?, error_handling: stop|skip|log, capture_ddl: bool }
```

**Invariants**
- `getChanges` must return changes in LSN order -- events must never be reordered within a stream
- A `truncate` operation must be captured as a single event, not as individual row deletions
- If the source schema changes and `capture_ddl` is enabled, the stream must not drop events during the schema transition

**Providers:** Debezium, PostgreSQL WAL (logical replication), AWS DMS, Kafka Connect, Maxwell

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `causal`
* **Details:** Changes within a table are delivered in causal order; cross-table ordering is not guaranteed

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for change events.
* **Details:** Duplicate events with the same LSN must be deduplicated by the consumer.

### Worker Scaling
* **Policy:** Each CDC stream must be independently scalable; one stream per source database is typical.

### Multi-Region Behavior
* **Mode:** CDC is single-region (source-bound); cross-region change replication requires a downstream stream processor.
* **Details:** The CDC connector must run in the same region as the source database.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If downstream consumers cannot keep up, the CDC stream must report lag and buffer up to the configured slot retention; exceeding retention causes data loss.

### Error Taxonomy
### Module-Specific Errors
```
configureCDC:
    table_not_wal_logged:    Source table does not have WAL logging enabled | enable logical replication
    slot_exists:             Replication slot already exists for this table | reuse existing slot

  startStream:
    slot_exhausted:          Replication slot retention exhausted; changes may have been lost | reconfigure with larger retention

  getChanges:
    lsn_not_available:       Requested LSN has been removed from the WAL | retention window exceeded
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
ChangeEvent       → cdc.table.inserted         { table, lsn, row_id }
                 OR cdc.table.updated          { table, lsn, row_id }
                 OR cdc.table.deleted          { table, lsn, row_id }
  SchemaChange     → cdc.schema.changed         { table, change_type }
```

### Temporal Constraints
```
Slot retention:
    default:        24 hours (Postgres)
    on_expiry:      slot may be removed; data loss possible

  Poll interval:
    default:        100ms
    on_idle:        exponential backoff to 5s max
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `change_data_capture.<function>`.
* **Telemetry Metrics:**
```
gensense_cdc_events_total                     { table, operation }
  gensense_cdc_lag_bytes                        gauge { stream_id }
  gensense_cdc_batch_size                       histogram { stream_id }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Storage Model
* **Model:** WAL-based change stream with durable LSN tracking.
* **Details:** Stream configuration and LSN offsets persist in the control table; change events are transient in the WAL and must be consumed before slot retention expires.

### Database Schema

#### PostgreSQL
```sql
CREATE TYPE cdc_stream_status AS ENUM ('stopped', 'running', 'failed');

CREATE TABLE cdc_streams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name      TEXT NOT NULL,
  source_type     TEXT NOT NULL,
  status          cdc_stream_status NOT NULL DEFAULT 'stopped',
  lsn             TEXT,
  slot_name       TEXT,
  publication     TEXT,
  config          JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cdc_streams_table ON cdc_streams(table_name);
CREATE INDEX idx_cdc_streams_status ON cdc_streams(status) WHERE status = 'running';

CREATE TABLE cdc_consumer_offsets (
  stream_id        UUID NOT NULL REFERENCES cdc_streams(id) ON DELETE CASCADE,
  consumer_group   TEXT NOT NULL,
  last_processed_lsn TEXT NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (stream_id, consumer_group)
);
```

### Module Dependencies
* **Depends On:** (none -- reads directly from database WAL)
* **Emits To:** events, event_bus
* **Recommends:** stream_processing, event_bus, storage
