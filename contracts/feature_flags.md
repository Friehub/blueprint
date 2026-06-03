# Module Contract: `feature_flags`

**Version:** 0.1.0

---

### `feature_flags`
Runtime feature control and progressive rollout.

**Functions**
```
isEnabled(flag_key, user_id?, context?) → boolean
getVariant(flag_key, user_id?, context?) → Variant
setFlag(flag_key, enabled, rules?) → Flag
archiveFlag(flag_key) → void
listFlags() → Flag[]
getFlag(flag_key) → Flag
rolloutToPercent(flag_key, percentage) → Flag
evaluateAll(user_id, context?) → Record<string, boolean>
```

**Types**
```
Flag { key, enabled, rollout_percentage?, rules?, variants? }
Variant { key, value, weight }
RolloutRule { attribute, operator, value, percentage }
```

**Invariants**
- Flag evaluation must be consistent for the same `(flag_key, user_id)` pair within a request
- Archived flags must always return `false` without error

**Providers:** LaunchDarkly, Unleash, Flagsmith, Growthbook, custom database

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** Flag changes propagate within the flag evaluation TTL

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for flag-change propagation events.
* **Details:** Duplicate propagation must not change the evaluated outcome unexpectedly.

### Worker Scaling
* **Policy:** Flag evaluation and remote sync/refresh workloads must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether flag evaluation is single-region or multi-region replicated.
* **Details:** Concurrent updates across regions must converge deterministically.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If flag sync is saturated, refreshes must be deferred or coalesced predictably.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
```
Flag evaluation cache:
    max_age:        30 seconds (default) -- flag evaluation must not serve data older than this
    on_expiry:      refetch from source

  Flag (with time-based rollout rule):
    start_at/end_at: enforced by the evaluation engine, not by caller
```

### Storage Model
* **Model:** Durable flag definition store with ephemeral evaluation cache.
* **Details:** The source of truth must be durable; the cache may be eventually consistent within the documented TTL.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `feature_flags.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** (none)
* **Recommends:** caching (for flag evaluation caching), audit_log
