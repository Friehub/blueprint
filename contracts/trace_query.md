# Module Contract: `trace_query`

**Version:** 0.2.1

---

### `trace_query`
Distributed trace search, retrieval, filtering, and service dependency inspection.

**Functions**
```
queryTraces(input, options?) → PaginatedResult<Trace>
getTrace(trace_id) → Trace
getSpan(span_id) → Span
listServices(options?) → ServiceTraceSummary[]
searchTraces(query, options?) → PaginatedResult<Trace>
getTraceStats(input) → TraceStats
getErrorTraces(input, options?) → PaginatedResult<Trace>
```

**Types**
```
Trace { id, trace_id, service, operation, status, duration_ms, start_at, end_at, spans_count, attributes? }
Span { id, trace_id, parent_span_id?, service, operation, status, duration_ms, start_at, end_at, attributes? }
ServiceTraceSummary { service, trace_count, error_count, p95_ms, last_seen_at }
TraceStats { trace_count, error_count, p50_ms, p95_ms, p99_ms }
TraceStatus = success | failure | not_found | timeout
```

**Invariants**
- Trace retrieval must be read-only.
- Queries must support correlation IDs and service filters.
- Trace data must preserve the original service and operation names.

**Providers:** Jaeger, Tempo, Honeycomb, Lightstep, Datadog APM, custom trace stores

---

### Consistency Model
* **Model:** `eventual` for trace ingestion; `strong` for single-trace queries
* **Details:** Query results reflect the most recent indexed state; requesting a single trace by ID returns the complete ingested spans for that trace

### Runtime Delivery Model
* **Delivery Guarantee:** `best_effort` for query results.
* **Details:** Trace query is read-only; retries are safe and idempotent.

### Worker Scaling
* **Policy:** Trace ingestion and query serving must be independently scalable.

### Multi-Region Behavior
* **Mode:** Trace storage is per-region; cross-region trace correlation uses trace_id.
* **Details:** A query that spans regions must fan out or route to the region where the trace root was ingested.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Details:** Query operations are read-only and inherently idempotent.

### Error Taxonomy
### Module-Specific Errors
```
queryTraces:
    trace_query_invalid:       The query filter combination is invalid | check filter semantics

  getTrace:
    trace_not_found:           The requested trace ID does not exist | verify trace ID
    trace_retention_expired:   Trace data has been deleted per retention policy | reduce query range

  getSpan:
    span_not_found:            The requested span ID does not exist | verify span ID
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. The trace_query module is read-only and does not emit business events.

### Temporal Constraints
```
Trace retention:
    default:        30 days
    on_expiry:      trace data is deleted per retention policy

  Query timeout:
    default:        30 seconds
    on_expiry:      return partial results if available; otherwise timeout error

  Index refresh interval:
    default:        60 seconds
    on_expiry:      newly ingested traces become queryable
```

### Storage Model
* **Model:** Durable trace index with searchable spans and service summaries.
* **Details:** Trace data is ingested from telemetry exporters and stored in a columnar or inverted-index store optimised for filter-and-aggregate queries.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `trace_query.<function>`.
* **Telemetry Metrics:**
```
blueprint_trace_query_operation_total              counter { function, result: success|failure }
blueprint_trace_query_operation_duration_ms        histogram { function, p50, p95, p99 }
blueprint_trace_query_errors_total                 counter { function, error_code }
blueprint_trace_query_traces_indexed_total         counter
blueprint_trace_query_spans_indexed_total          counter
blueprint_trace_query_query_latency_ms             histogram { query_type }
blueprint_trace_query_trace_retrieval_latency_ms   histogram
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Trace index unavailable | Return ProviderError; caller should retry with backoff |
| Trace data retention expired | Return trace_retention_expired; suggest narrower time range |
| Query timeout exceeded | Return partial results if paginated; otherwise timeout error |
| Span not found in a found trace | Return span_not_found; trace may be partially ingested |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise

### Module Dependencies
* **Depends On:** telemetry
* **Emits To:** (none — read-only)
* **Recommends:** error_tracking, security_monitoring, analytics, audit_log, search
