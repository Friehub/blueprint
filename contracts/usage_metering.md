# Module Contract: `usage_metering`

**Version:** 0.1.0

---

### `usage_metering`
Track and enforce resource consumption quotas.

**Functions**
```
recordUsage(user_id, metric, quantity, timestamp?) → UsageRecord
getUsageSummary(user_id, metric, period) → UsageSummary
checkQuota(user_id, metric) → QuotaCheck
getOverage(user_id, metric, period) → Overage?
setQuota(user_id, metric, limit) → void
resetUsage(user_id, metric) → void
getUsageHistory(user_id, metric, options?) → PaginatedResult<UsageRecord>
```

**Types**
```
UsageRecord { id, user_id, metric, quantity, timestamp }
UsageSummary { metric, total, limit, period_start, period_end }
QuotaCheck { allowed, used, limit, remaining }
Overage { amount, metric, period }
```

**Invariants**
- `recordUsage` must be eventually consistent but `checkQuota` must reflect all committed records

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** `recordUsage` is eventually consistent; `checkQuota` reflects committed records

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
* None explicitly defined.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `usage_metering.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** (none)
* **Recommends:** caching (for quota reads), billing (to trigger overage billing)
