# Module Contract: `analytics`

**Version:** 0.1.0

---

### `analytics`
Event tracking and behavioral analytics.

**Functions**
```
trackEvent(event_name, user_id?, properties?, context?) → void
identifyUser(user_id, traits) → void
trackPageView(user_id?, url, properties?) → void
getMetrics(metric, period, filters?) → MetricResult
getFunnel(steps, period, filters?) → FunnelResult
getCohort(definition, period) → CohortResult
getRetention(cohort_start, periods) → RetentionResult
```

**Types**
```
AnalyticsEvent { name, user_id?, properties, context, timestamp }
MetricResult { value, previous_value?, change_percent?, series: DataPoint[] }
FunnelResult { steps: FunnelStep[], conversion_rate }
FunnelStep { name, count, conversion_rate }
DataPoint { timestamp, value }
```

**Invariants**
- `trackEvent` must never throw -- analytics must not cause application errors
- Events must be buffered and sent asynchronously

**Providers:** PostHog, Mixpanel, Amplitude, custom ClickHouse

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** Event tracking is best-effort; metrics may lag by minutes

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for buffered ingestion.
* **Details:** Duplicate events must be deduplicated by event identity or accepted as safe duplicates by downstream aggregation.

### Worker Scaling
* **Policy:** Ingestion, buffering, and aggregation workloads must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether analytics ingestion is single-region or active/active.
* **Details:** Duplicate cross-region ingest must be deduplicated when possible.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If ingestion capacity is saturated, events must be buffered, sampled, or dropped according to explicit policy; the policy must be documented by the adapter.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
```
Buffer retention:
    max_age:           configurable per deployment
    on_expiry:         flush or drop according to explicit sampling policy
```

### Storage Model
* **Model:** Append-only analytics pipeline / warehouse-backed event store.
* **Details:** Raw events may be buffered, queued, or written to a warehouse; retention and replay semantics must be documented by the provider.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `analytics.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none -- fire and forget)
* **Emits To:** (none)
* **Recommends:** queues (for buffered ingestion)
