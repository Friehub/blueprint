# Module Contract: `analytics`

**Version:** 0.2.0

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
- `identifyUser` must merge traits deterministically: later trait values overwrite earlier ones for the same key; arrays are unioned
- `getFunnel` must return steps in the order provided in the input; a step with zero count must still appear in the result with `conversion_rate: 0`
- Metric query results must be consistent within a single query: repeated calls with identical `(metric, period, filters)` within the same minute must return identical values

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
```
trackEvent        → analytics.event.tracked       { event_name, user_id?, properties_summary }
identifyUser      → analytics.user.identified     { user_id, trait_count }
trackPageView     → analytics.page_view.tracked    { url, user_id? }
```

Note: Custom events tracked via `trackEvent` use the caller-defined `event_name` as the event topic suffix. Analytics-internal events (buffer flush, aggregation complete) are emitted to the tracing layer only.

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
* **Telemetry Metrics:**
```
blueprint_analytics_operation_total              counter { function, result }
blueprint_analytics_operation_duration_ms        histogram { function }
blueprint_analytics_errors_total                 counter { function, error_code }
blueprint_analytics_events_tracked_total          counter { event_name }
blueprint_analytics_users_identified_total        counter
blueprint_analytics_page_views_tracked_total      counter
blueprint_analytics_queries_total                 counter { query_type }
blueprint_analytics_buffer_flush_size_bytes       histogram
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none -- fire and forget)
* **Emits To:** events
* **Recommends:** queues (for buffered ingestion), data_warehouse (for long-term aggregation)

### Database Schema

#### PostgreSQL (Aggregation Cache & User Traits)
```sql
CREATE TABLE analytics_user_traits (
  user_id     UUID NOT NULL,
  traits      JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id)
);

CREATE TABLE analytics_metric_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric          TEXT NOT NULL,
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  value           NUMERIC(19,4),
  series          JSONB DEFAULT '[]',
  filters_hash    TEXT,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (metric, period_start, period_end, filters_hash)
);

CREATE INDEX idx_analytics_metric_cache_lookup ON analytics_metric_cache(metric, period_start DESC);
```

### Breaking Change Policy
- Adding new metric types or funnel steps is additive and backward-compatible.
- Removing or renaming an existing metric name requires a MAJOR version bump.
- Changing the event buffering strategy from async to sync requires a MAJOR version bump.
- Adding new required fields to `trackEvent` context requires a MINOR version bump (backward-compatible with default).

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Event lost during buffer flush | Provider API timeout | Retry with backoff; dead-letter after 3 attempts; trackEvent never throws |
| User trait merge conflict | Concurrent identifyUser calls | Last-write-wins; trait-level merge not guaranteed under concurrent writes |
| Metric query timeout | Large period with high cardinality | Return cached/pre-computed result with staleness warning |
| Provider rate limit | Exceeded provider throughput | Buffer events; apply client-side rate limiting; emit provider_error |
| Data loss on service restart | In-memory buffer not flushed | Use persistent buffer (Redis or disk); flush on graceful shutdown |
