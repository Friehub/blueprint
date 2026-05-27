# Module Contract: `trace_query`

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

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Trace ingestion may be eventual, but query results must be internally coherent for the requested trace ID.
- **Idempotency:** Query operations are read-only; any ingest-side adapter support must be idempotent on trace identity.
- **Storage Model:** Durable trace index with searchable spans and service summaries.
- **Dependencies:** `error_tracking`, `security_monitoring`, `analytics`, `audit_log`, `search`.
- **Errors:** `TRACE_NOT_FOUND`, `SPAN_NOT_FOUND`, `TRACE_QUERY_INVALID`, `TRACE_RETENTION_EXPIRED`, `TRACE_EXPORT_TOO_LARGE`.
