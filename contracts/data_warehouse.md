# Module Contract: `data_warehouse`

**Version:** 0.1.0

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

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `data_warehouse.<function>`.
* **Telemetry Metrics:**
```
gensense_data_warehouse_queries_total            { status }
  gensense_data_warehouse_query_duration_ms        histogram
  gensense_data_warehouse_bytes_processed_total    { project }
  gensense_data_warehouse_storage_bytes            gauge { table }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** reporting
* **Emits To:** events
* **Recommends:** data_pipeline, data_catalog, config
