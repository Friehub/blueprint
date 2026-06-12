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
createSegment(name, matchers) → Segment
updateSegment(segment_id, matchers) → Segment
deleteSegment(segment_id) → void
listSegments() → Segment[]
evaluateSegment(segment_id, user_id, context?) → boolean
```

**Types**
```
Flag { key, enabled, rollout_percentage?, rules?, segments[]?, variants?, targeting: TargetingRule[] }
Variant { key, value, weight }
RolloutRule { attribute, operator, value, percentage }
Segment { id, name, matchers: SegmentMatcher[], created_at, updated_at }
SegmentMatcher { attribute, operator: in|not_in|contains|matches|gte|lte|before|after, values: string[] }
TargetingRule { segment_id | user_ids[] | percentage, variant?, serve: boolean|variant_key }
```

**Invariants**
- Flag evaluation must be consistent for the same `(flag_key, user_id)` pair within a request
- Archived flags must always return `false` without error
- Segment matchers must be evaluated in order and the first matching rule determines the segment membership -- a user must not match multiple overlapping segment rules
- A `TargetingRule` referencing a deleted segment must be treated as `serve: false` -- the evaluation must not throw
- When a flag has both `rollout_percentage` and `segments`, segment-matched users must bypass the percentage rollout -- segments take priority over percentage

**Providers:** LaunchDarkly, Unleash, Flagsmith, Growthbook, Split, custom database

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
```
setFlag              → flag.created                     { flag_key, enabled }
setFlag (update)     → flag.updated                     { flag_key, changes }
setFlag(disabled)    → flag.disabled                    { flag_key, disabled_by }
archiveFlag          → flag.archived                    { flag_key }
rolloutToPercent     → flag.rollout.updated             { flag_key, percentage }
isEnabled            → flag.evaluated                   { flag_key, user_id, result, variant? }
createSegment        → segment.created                  { segment_id, name }
updateSegment        → segment.updated                  { segment_id, changes }
deleteSegment        → segment.deleted                  { segment_id }
```

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
* **Telemetry Metrics:**
```
gensense_feature_flags_operation_total           counter { function, result: success|failure }
gensense_feature_flags_operation_duration_ms     histogram { function, p50, p95, p99 }
gensense_feature_flags_errors_total              counter { function, error_code }
gensense_feature_flags_evaluations_total         counter { flag_key, result: enabled|disabled }
gensense_feature_flags_active_total              gauge
gensense_feature_flags_variant_distribution      counter { flag_key, variant }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return provider_error, do not retry indefinitely |
| Provider rate limited | Respect Retry-After header, apply exponential backoff |
| Partial success in batch | Return partial_success with succeeded[] and failed[] |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** (none)
* **Recommends:** caching (for flag evaluation caching), audit_log
