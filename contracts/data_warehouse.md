# Module Contract: `data_warehouse`

**Version:** 0.2.1

---

### `data_warehouse`
Analytics table and view management with query execution, partitioning, and cost control.

**Functions**
```
createTable(name, schema, options?) → Table
getTable(table_name) → Table
listTables(schema?) → Table[]
createView(name, query, options?) → View
runQuery(sql, options?) → QueryResult
getQueryHistory(options?) → PaginatedResult<QueryRecord>
addPartition(table_name, partition_def) → void
getStorageUsage() → StorageReport
setQueryBudget(project, budget) → void
```

**Types**
```
Table { name, schema, row_count, size_bytes, partitioning?, created_at, last_queried_at }
View { name, query, materialized: bool, refresh_interval?, created_at }
QueryResult { columns, rows, row_count, duration_ms, bytes_processed, cost_estimate }
QueryRecord { id, sql_hash, duration_ms, bytes_processed, cost, executed_at }
StorageReport { tables: TableStats[], total_size_bytes, total_cost_estimate, by_schema }
TableOptions { clustering?, partitioning?, retention?, replication_factor? }
PartitionDef { column, type: range|list, granularity: day|month|year }
```

**Invariants**
- `runQuery` must reject queries that exceed the project's configured query budget before execution
- A materialized view must reflect the source table data within one `refresh_interval` of the source being updated
- Dropping a table that is referenced by an active view must be rejected unless `cascade: true` is explicitly passed

**Providers:** BigQuery, Snowflake, Redshift, ClickHouse, DuckDB

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** Warehouse data reflects source data after ETL latency; query results are read-committed

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for DDL statements; query results are best-effort.
* **Details:** Duplicate DDL statements must be idempotent (CREATE IF NOT EXISTS semantics).

### Worker Scaling
* **Policy:** Query execution, DDL operations, and cost tracking must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether the warehouse is single-region or multi-region replicated.
* **Details:** Cross-region queries must be routed to the region containing the data or explicitly flagged as cross-region.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* Query execution must respect concurrency limits; excess queries must queue or be rejected with a `concurrency_limit_exceeded` error.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
runQuery          → warehouse.query.executed    { sql_hash, bytes_processed, cost }
  createTable       → warehouse.table.created     { table_name }
  createView        → warehouse.view.created      { view_name, materialized }
```

### Temporal Constraints
```
Query timeout:
    default:        30 minutes
    on_expiry:      cancel query and return timeout error

  Materialized view refresh:
    default:        1 hour
    on_expiry:      view data is stale; refresh triggered on next query
```

### Storage Model
* **Model:** Durable table/view catalog with query history and partition metadata.
* **Details:** Table schemas, view definitions, and storage reports must remain queryable for the configured retention period. Query history is append-only.

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE warehouse_tables (
  name              TEXT PRIMARY KEY,
  schema_def        JSONB NOT NULL,
  row_count         BIGINT NOT NULL DEFAULT 0,
  size_bytes        BIGINT NOT NULL DEFAULT 0,
  partitioning      JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_queried_at   TIMESTAMPTZ
);

CREATE TABLE warehouse_views (
  name              TEXT PRIMARY KEY,
  query             TEXT NOT NULL,
  materialized      BOOLEAN NOT NULL DEFAULT false,
  refresh_interval  INTERVAL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE warehouse_query_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sql_hash          TEXT NOT NULL,
  duration_ms       INT NOT NULL,
  bytes_processed   BIGINT NOT NULL DEFAULT 0,
  cost              NUMERIC(12,4),
  executed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  project           TEXT NOT NULL
);

CREATE INDEX idx_wh_query_history_executed ON warehouse_query_history(executed_at DESC);
CREATE INDEX idx_wh_query_history_project ON warehouse_query_history(project);

CREATE TABLE warehouse_partitions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name        TEXT NOT NULL REFERENCES warehouse_tables(name) ON DELETE CASCADE,
  column_name       TEXT NOT NULL,
  partition_type    TEXT NOT NULL CHECK (partition_type IN ('range', 'list')),
  granularity       TEXT NOT NULL CHECK (granularity IN ('day', 'month', 'year')),
  partition_def     JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE warehouse_query_budgets (
  project           TEXT PRIMARY KEY,
  budget            NUMERIC(12,4) NOT NULL,
  spent             NUMERIC(12,4) NOT NULL DEFAULT 0,
  period_start      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Failure Modes & Breaking Change Policy

| Failure Mode | Detection | Mitigation |
|---|---|---|
| Query exceeds budget | Pre-execution check in `runQuery` | Reject with `budget_exceeded`; alert project owner |
| Materialized view staleness | `refresh_interval` exceeded | Trigger refresh on next query; emit `warehouse.view.stale` |
| Cross-region query routed incorrectly | Latency spike or data mismatch | Route to correct region; flag in query metadata |
| Provider rate limit | `RateLimited` error from provider | Queue and retry with exponential backoff |
| DDL idempotency failure | Duplicate table creation | Use `CREATE IF NOT EXISTS` semantics |

**Breaking Changes:** Dropping or renaming a column in an existing table schema requires a new table version. Existing views referencing the old schema must be migrated before the breaking change is applied. A deprecation notice must be published at least 2 release cycles before removal.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `data_warehouse.<function>`.
* **Telemetry Metrics:**
```
blueprint_data_warehouse_queries_total            { status }
  blueprint_data_warehouse_query_duration_ms        histogram
  blueprint_data_warehouse_bytes_processed_total    { project }
  blueprint_data_warehouse_storage_bytes            gauge { table }
  blueprint_data_warehouse_budget_exceeded_total    { project }
  blueprint_data_warehouse_partition_count          gauge
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** reporting
* **Emits To:** events
* **Recommends:** data_pipeline, data_catalog, config
