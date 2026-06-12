# Module Contract: `telemetry`

**Version:** 0.1.0

---

### `telemetry`
Structured emission of spans, metrics, and logs with sampling and correlation.

**Functions**
```
createSpan(name, options?) → Span
endSpan(span_id, status) → void
addSpanEvent(span_id, name, attributes?) → void
recordMetric(name, value, attributes?, metric_type?) → void
incrementCounter(name, value?, attributes?) → void
recordHistogram(name, value, attributes?) → void
setGauge(name, value, attributes?) → void
setLogLevel(level) → void
log(level, message, context?) → void
```

**Types**
```
Span { id, trace_id, parent_id?, name, status: ok|error, start_time, end_time?, attributes }
SpanOptions { parent_id?, attributes?, start_time?, links? }
MetricType = counter | histogram | gauge
LogLevel = trace | debug | info | warn | error | fatal
LogEntry { timestamp, level, message, trace_id?, span_id?, attributes }
TelemetryConfig { service_name, environment, sampling_rate, exporters }
```

**Invariants**
- `createSpan` without an active trace context must generate a new trace_id; with a context it must inherit it
- `endSpan` with a pending span must compute duration automatically if no start_time was provided
- Telemetry export must never block the calling function -- export failures must not propagate to the caller

**Providers:** OpenTelemetry, Datadog, Honeycomb, Sentry, custom OTLP exporter

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** Telemetry data is always best-effort; consistency guarantees are not applicable

### Runtime Delivery Model
* **Delivery Guarantee:** `best_effort`. Telemetry export must not block or break application code.
* **Details:** Export failures are logged locally and dropped, not retried.

### Worker Scaling
* **Policy:** Span processing, metric aggregation, and export must be independently scalable and typically run on a background goroutine/thread.

### Multi-Region Behavior
* **Mode:** Telemetry must be tagged with region and exported to a regional or global observability backend as configured.
* **Details:** Cross-region trace correlation uses trace_id; no real-time region-to-region telemetry sync.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If the export pipeline is saturated, the module must drop or sample telemetry rather than blocking the application.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Telemetry is the emission layer for other modules -- it does not emit its own business events.

### Temporal Constraints
```
Span timeout:
    default:        none (spans are ended explicitly by the caller)
    on_expiry:      orphaned spans are exported after max_span_duration config

  Export batch interval:
    default:        5 seconds
    max_batch_size: 512 items
```

### Observability
* **Tracing Spans:** Span names follow the pattern `telemetry.<function>`. This module is itself observed.
* **Telemetry Metrics:**
```
gensense_telemetry_spans_created_total         { status }
  gensense_telemetry_metrics_recorded_total      { metric_type }
  gensense_telemetry_export_batch_size           histogram
  gensense_telemetry_export_duration_ms          histogram
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Export backend unreachable | Log locally, drop batch, do not block application; increment `gensense_telemetry_export_duration_ms` with error |
| Export batch full | Flush immediately; do not drop data |
| Sampling queue overflow | Apply head-sampling, drop lowest-priority spans first |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise

### Module Dependencies
* **Depends On:** (none -- infrastructure primitive / wraps open telemetry SDK)
* **Emits To:** (none -- exports to external telemetry backend)
* **Recommends:** config, health
