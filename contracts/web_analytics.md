# Module Contract: `web_analytics`

**Version:** 0.1.0

---

### `web_analytics`
Website-centric traffic, session, attribution, and conversion tracking.

**Functions**
```
trackPageView(url, user_id?, context?) → void
trackSessionStart(session_id, context?) → void
trackSessionEnd(session_id, context?) → void
trackConversion(event_name, user_id?, context?) → void
getPageMetrics(input) → PageMetrics
getAttributionReport(input) → AttributionReport
getSessionReplay(session_id) → SessionReplay?
```

**Types**
```
PageMetrics { url, views, unique_visitors, bounce_rate, avg_time_on_page, period }
AttributionReport { source, medium, campaign?, conversions, revenue? }
SessionReplay { session_id, events, created_at }
```

**Invariants**
- Tracking must never block the calling application.
- Session and page events must be attributable to a stable session identity when available.
- Replays and aggregates must not expose sensitive PII unless explicitly configured.

**Providers:** GA4, Mixpanel, PostHog, Amplitude, Plausible, custom event collection pipelines

---

### Consistency Model
* **Model:** `eventual`
* **Details:** Tracking is best-effort; durable aggregation can be eventual

### Runtime Delivery Model
* **Delivery Guarantee:** `best_effort` for tracking events; `at_least_once` for derived aggregates.
* **Details:** Tracking must never block the calling application — fire-and-forget with local batching.

### Worker Scaling
* **Policy:** Event ingestion, session processing, and aggregation must be independently scalable.

### Multi-Region Behavior
* **Mode:** Event ingestion is per-region; aggregates are global.
* **Details:** Cross-region session stitching uses a stable session_id — same session_id across regions is merged at aggregation time.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Details:** Tracking functions must be idempotent on event/session identity where applicable.

### Error Taxonomy
### Module-Specific Errors
```
trackPageView:
    tracking_disabled:         Tracking is disabled for this user or domain | respect consent
    event_too_large:           Event payload exceeds maximum size | trim payload

  getPageMetrics:
    report_not_found:          No metrics available for the requested period | expand date range

  getAttributionReport:
    attribution_unavailable:   Attribution data is not available for this period | check tracking setup
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
trackPageView      → analytics.page_viewed          { url, session_id?, user_id? }
trackConversion    → analytics.conversion_tracked   { event_name, user_id?, value? }
trackSessionStart  → analytics.session.started       { session_id }
trackSessionEnd    → analytics.session.ended         { session_id, duration_ms }
```

### Temporal Constraints
```
Event retention:
    default:        90 days for raw events
    on_expiry:      raw events deleted; aggregates preserved

  Session timeout:
    default:        30 minutes of inactivity
    on_expiry:      session ends; emit session.ended

  Aggregation interval:
    default:        1 hour for page metrics
    on_expiry:      recompute aggregates from raw events
```

### Storage Model
* **Model:** Append-only web event store with derived aggregates.
* **Details:** Raw events are stored in a time-partitioned table; aggregates are computed via scheduled jobs or materialized views.

```sql
CREATE TABLE analytics_page_views (
    id              UUID PRIMARY KEY,
    url             TEXT NOT NULL,
    session_id      VARCHAR(255),
    user_id         UUID,
    context         JSONB,
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (ingested_at);

CREATE TABLE analytics_sessions (
    session_id      VARCHAR(255) PRIMARY KEY,
    user_id         UUID,
    started_at      TIMESTAMPTZ NOT NULL,
    ended_at        TIMESTAMPTZ,
    context         JSONB
);

CREATE TABLE analytics_conversions (
    id              UUID PRIMARY KEY,
    event_name      VARCHAR(255) NOT NULL,
    user_id         UUID,
    context         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE analytics_page_metrics (
    url             TEXT NOT NULL,
    period_start    TIMESTAMPTZ NOT NULL,
    views           BIGINT NOT NULL DEFAULT 0,
    unique_visitors BIGINT NOT NULL DEFAULT 0,
    bounce_rate     DOUBLE PRECISION,
    avg_time_on_s   DOUBLE PRECISION,
    PRIMARY KEY (url, period_start)
);

CREATE INDEX idx_analytics_page_views_session ON analytics_page_views(session_id);
CREATE INDEX idx_analytics_page_views_ingested ON analytics_page_views(ingested_at);
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `web_analytics.<function>`.
* **Telemetry Metrics:**
```
blueprint_web_analytics_operation_total           counter { function, result: success|failure }
blueprint_web_analytics_operation_duration_ms     histogram { function, p50, p95, p99 }
blueprint_web_analytics_errors_total              counter { function, error_code }
blueprint_web_analytics_events_ingested_total     counter { event_type: page_view|conversion|session }
blueprint_web_analytics_events_dropped_total      counter { reason }
blueprint_web_analytics_aggregation_latency_ms    histogram
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Event ingestion queue full | Drop event, increment dropped counter; do not block application |
| Aggregation job fails | Retry on next interval; alert operator after 3 consecutive failures |
| Session merge conflict | Last-write-wins on session end time; no data loss |
| Database write failure on ingest | Drop event, log error; application is not blocked |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise

### Module Dependencies
* **Depends On:** analytics, consent
* **Emits To:** events
* **Recommends:** caching, audit_log, sessions
