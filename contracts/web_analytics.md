# Module Contract: `web_analytics`

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

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Tracking is best-effort; durable aggregation can be eventual.
- **Idempotency:** Tracking functions must be idempotent on event/session identity where applicable.
- **Storage Model:** Append-only web event store with derived aggregates.
- **Dependencies:** `analytics`, `consent`, `caching`, `audit_log`, `sessions`.
- **Errors:** `TRACKING_DISABLED`, `SESSION_NOT_FOUND`, `REPORT_NOT_FOUND`, `ATTRIBUTION_UNAVAILABLE`, `EVENT_TOO_LARGE`.
