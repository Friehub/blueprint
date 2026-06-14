# Module: cache_invalidation

**Version:** 0.2.1
**Part:** III -- Data and State

## Purpose

Defines the interface for managing declarative cache invalidation rules. A cache invalidation rule is a named binding between a domain event and one or more cache key patterns that must be purged when that event fires. This module decouples the knowledge of "what happened" (the event) from the knowledge of "what needs to be purged" (the cache keys) without coupling the event-producing domain to the caching layer. Without this module, invalidation logic is scattered across domain implementations or relies on TTL expiry alone, leading to stale data windows that violate consistency contracts.

This module is distinct from `caching`, which owns the low-level get/set/delete operations. `cache_invalidation` owns the rule engine that calls those operations in response to events.

---

## State Machine

### Rule State
```
ACTIVE → DISABLED → ACTIVE
ACTIVE → DELETED
```

### Invalidation Job State
```
TRIGGERED → PROCESSING → COMPLETED
                       → PARTIALLY_COMPLETED  (some keys failed)
                       → FAILED
```

Transitions:
- `ACTIVE`: rule is live and will respond to matching events
- `DISABLED`: rule is paused; events are received but no purge is performed
- `TRIGGERED → PROCESSING`: event matched; worker begins purging keys
- `PROCESSING → COMPLETED`: all targeted keys purged successfully
- `PROCESSING → PARTIALLY_COMPLETED`: some keys failed; retried keys listed
- `PROCESSING → FAILED`: total failure

---

## Functions

### `createRule(input: CreateRuleInput) → InvalidationRule`
Defines a named rule that maps a domain event pattern to a set of cache key patterns to purge.

### `getRule(ruleId: InvalidationRuleId) → InvalidationRule`
Returns a rule definition and its current state.

### `listRules(input: ListRulesInput) → PaginatedList<InvalidationRule>`
Returns all invalidation rules, optionally filtered by source module or event name.

### `updateRule(input: UpdateRuleInput) → InvalidationRule`
Updates a rule's key patterns or event filters. Active rules are updated atomically.

### `disableRule(ruleId: InvalidationRuleId) → InvalidationRule`
Temporarily disables a rule without deleting it.

### `enableRule(ruleId: InvalidationRuleId) → InvalidationRule`
Re-activates a disabled rule.

### `deleteRule(ruleId: InvalidationRuleId) → void`
Permanently removes a rule. In-flight invalidation jobs for this rule are completed before deletion.

### `triggerInvalidation(input: TriggerInvalidationInput) → InvalidationJob`
Manually triggers invalidation for a rule without an incoming event. Used for cache warming resets, deployments, and manual corrections.

### `getJob(jobId: InvalidationJobId) → InvalidationJob`
Returns the state and outcome of a specific invalidation job.

### `listJobs(input: ListJobsInput) → PaginatedList<InvalidationJob>`
Returns invalidation jobs filtered by rule, status, or date range.

### `previewInvalidation(input: TriggerInvalidationInput) → string[]`
Dry-runs a rule against a sample event payload and returns the resolved cache key patterns without performing any purges. Used for rule testing.

---

## Types

```typescript
type InvalidationRuleId = string;
type InvalidationJobId = string;

type RuleStatus = "ACTIVE" | "DISABLED";
type JobStatus = "TRIGGERED" | "PROCESSING" | "COMPLETED" | "PARTIALLY_COMPLETED" | "FAILED";

type KeyPattern = {
  pattern: string;                 // Cache key pattern with variable interpolation, e.g. "user:{event.data.userId}:*"
  cacheStore?: string;             // Target cache store name; null = default store
};

type EventFilter = {
  eventName: string;               // Exact event name, e.g. "order.status_changed"
  sourceModule?: string;           // Optional filter to prevent cross-module collision
  payloadConditions?: {
    field: string;
    operator: "eq" | "in" | "exists";
    value?: unknown;
  }[];
};

type CreateRuleInput = {
  name: string;
  description?: string;
  eventFilter: EventFilter;
  keyPatterns: KeyPattern[];
  priority?: number;               // Higher priority rules execute first when multiple rules match
  maxRetries?: number;             // Retry count for failed key purges; defaults to 3
};

type UpdateRuleInput = {
  ruleId: InvalidationRuleId;
  name?: string;
  description?: string;
  keyPatterns?: KeyPattern[];
  maxRetries?: number;
};

type InvalidationRule = {
  ruleId: InvalidationRuleId;
  name: string;
  description?: string;
  eventFilter: EventFilter;
  keyPatterns: KeyPattern[];
  priority: number;
  maxRetries: number;
  status: RuleStatus;
  totalTriggeredCount: number;
  lastTriggeredAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type TriggerInvalidationInput = {
  ruleId: InvalidationRuleId;
  eventPayload: Record<string, unknown>;  // Used for pattern interpolation
  triggeredBy?: UserId;
};

type InvalidationJob = {
  jobId: InvalidationJobId;
  ruleId: InvalidationRuleId;
  status: JobStatus;
  resolvedKeyPatterns: string[];   // Patterns after variable interpolation
  purgedKeys: string[];
  failedKeys: string[];
  triggeredAt: Timestamp;
  completedAt?: Timestamp;
  errorMessage?: string;
};

type ListRulesInput = {
  sourceModule?: string;
  eventName?: string;
  status?: RuleStatus;
  pagination: PaginationInput;
};

type ListJobsInput = {
  ruleId?: InvalidationRuleId;
  status?: JobStatus;
  fromDate?: Timestamp;
  toDate?: Timestamp;
  pagination: PaginationInput;
};
```

---

## Invariants

1. Key pattern variable interpolation uses dot-notation paths into the event payload (e.g. `{event.data.userId}`); invalid paths resolve to an empty string, which is logged as a warning but does not abort the job.
2. A rule with no `keyPatterns` is invalid and must be rejected at creation.
3. Rules in `DISABLED` state must still consume matching events from the event bus (to avoid queue lag); they must discard without purging.
4. `triggerInvalidation` on a `DISABLED` rule returns `RULE_DISABLED` and performs no purge.
5. Invalidation jobs must be idempotent: purging the same key twice in a single job has the same effect as purging it once.
6. `previewInvalidation` must never call `caching.delete`; it is a read-only operation.
7. `priority` determines execution order when multiple rules match the same event; lower-numbered rules execute first. Ties are broken by `createdAt` descending.
8. The module must not guarantee synchronous invalidation; purge completion is eventual. The maximum acceptable lag from event receipt to cache purge completion is 500ms under normal load.

---

## Events Emitted

- `cache_invalidation.rule.created`
- `cache_invalidation.rule.updated`
- `cache_invalidation.rule.disabled`
- `cache_invalidation.rule.enabled`
- `cache_invalidation.rule.deleted`
- `cache_invalidation.job.triggered` -- includes `ruleId`, `resolvedKeyPatterns`
- `cache_invalidation.job.completed` -- includes `purgedKeys` count
- `cache_invalidation.job.failed` -- includes `failedKeys`

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** Rule matching and purge completion is eventual. The maximum acceptable lag from event receipt to cache purge completion is 500ms under normal load.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for invalidation events.
* **Details:** Duplicate events may trigger duplicate jobs, but idempotent purges make this safe. Idempotency is per `(ruleId, eventPayload)`.

### Worker Scaling
* **Policy:** Purge workers must be independently scalable from event consumption workers.

### Multi-Region Behavior
* **Mode:** The module must declare whether invalidation execution is single-region or active/passive; duplicate event processing across regions must be deduplicated.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Required Functions:**
  - `createRule(input, idempotency_key?)`
  - `updateRule(input, idempotency_key?)`
  - `disableRule(ruleId, idempotency_key?)`
  - `enableRule(ruleId, idempotency_key?)`
  - `deleteRule(ruleId, idempotency_key?)`
  - `triggerInvalidation(input, idempotency_key?)`

### Backpressure
* If purge capacity is saturated, matching events must be deferred or queued predictably rather than dropping invalidations silently.

### Dead-Letter Handling
* Failed invalidation jobs that exhaust retries must be retained in an operator-queryable failed state with the original rule and key patterns.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).
* Domain errors: `RULE_NOT_FOUND`, `RULE_DISABLED`, `JOB_NOT_FOUND`, `INVALID_KEY_PATTERN`, `CACHE_STORE_UNAVAILABLE`, `RULE_NAME_CONFLICT`, `PURGE_WORKER_UNAVAILABLE`.

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
cache_invalidation.rule.created
cache_invalidation.rule.updated
cache_invalidation.rule.disabled
cache_invalidation.rule.enabled
cache_invalidation.rule.deleted
cache_invalidation.job.triggered       { ruleId, resolvedKeyPatterns }
cache_invalidation.job.completed       { ruleId, purgedKeys count }
cache_invalidation.job.failed          { ruleId, failedKeys }
```

### Temporal Constraints
```
Invalidation job:
    default_timeout:    30 seconds per job
    on_exceed:          transition to FAILED; retry up to maxRetries

    max_retries:
        default:        3
        on_exhausted:   move to dead-letter; remain queryable

    job_history_retention:
        default:        30 days
        on_expiry:      eligible for deletion; aggregates preserved

Rule latency budget:
    from_event_to_purge: 500ms
    on_exceed:          increment cache_invalidation_lag_ms; emit alert
```

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE invalidation_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL UNIQUE,
  description       TEXT,
  event_name        TEXT NOT NULL,
  source_module     TEXT,
  payload_conditions JSONB DEFAULT '[]',
  key_patterns      JSONB NOT NULL DEFAULT '[]',
  priority          INTEGER NOT NULL DEFAULT 0,
  max_retries       INTEGER NOT NULL DEFAULT 3,
  status            TEXT NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('ACTIVE', 'DISABLED')),
  total_triggered_count INTEGER NOT NULL DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invalidation_rules_event ON invalidation_rules(event_name, source_module) WHERE status = 'ACTIVE';
CREATE INDEX idx_invalidation_rules_priority ON invalidation_rules(priority, created_at);

CREATE TABLE invalidation_jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id             UUID NOT NULL REFERENCES invalidation_rules(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'TRIGGERED'
                        CHECK (status IN ('TRIGGERED', 'PROCESSING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED')),
  resolved_key_patterns TEXT[] NOT NULL DEFAULT '{}',
  purged_keys         TEXT[] DEFAULT '{}',
  failed_keys         TEXT[] DEFAULT '{}',
  triggered_by        UUID,
  error_message       TEXT,
  retry_count         INTEGER NOT NULL DEFAULT 0,
  triggered_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ
);

CREATE INDEX idx_invalidation_jobs_rule ON invalidation_jobs(rule_id, triggered_at DESC);
CREATE INDEX idx_invalidation_jobs_status ON invalidation_jobs(status, triggered_at) WHERE status IN ('TRIGGERED', 'PROCESSING', 'FAILED');
```

### Storage Model
* **Model:** Durable rule definition store with invalidation job history.
* **Details:** Rule definitions and invalidation job history must be durably stored; high-volume job history may be trimmed by retention policy, but the active rule set must remain strongly consistent.

### Observability
* **Tracing Spans:** Each invalidation job emits a trace span annotated with `ruleId`, `purgedKeyCount`, `failedKeyCount`, and `durationMs`. Every function call follows `cache_invalidation.<function>`.
* **Telemetry Metrics:**
```
blueprint_cache_invalidation_operation_total              counter { function, result }
blueprint_cache_invalidation_operation_duration_ms        histogram { function }
blueprint_cache_invalidation_errors_total                 counter { function, error_code }
blueprint_cache_invalidation_rules_total                   gauge { status }
blueprint_cache_invalidation_jobs_total                    counter { status }
blueprint_cache_invalidation_keys_purged_total             counter { rule_id }
blueprint_cache_invalidation_keys_failed_total             counter { rule_id, error_code }
blueprint_cache_invalidation_lag_ms                       gauge
```
* **SLO Targets:** Event-to-purge P99 ≤ 500ms; rule creation P99 ≤ 200ms.

### Module Dependencies
* **Depends On:** caching, queues
* **Emits To:** events
* **Recommends:** config, audit_log

### Breaking Change Policy
- Adding a new pattern interpolation variable syntax is additive and backward-compatible.
- Removing or renaming a key pattern variable syntax requires a MAJOR version bump.
- Changing the priority evaluation order (lower vs higher executes first) requires a MAJOR version bump.
- Adding new required fields to `CreateRuleInput` requires a MAJOR version bump.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Cache store unavailable | Redis/backend down during purge | Retry with backoff; dead-letter after maxRetries; emit CACHE_STORE_UNAVAILABLE |
| Invalid key pattern | Pattern variable not found in event payload | Log warning; interpolate empty string; continue purge |
| Job timeout | Too many keys to purge in 30s | Split job into batches; increase by adapter config |
| Duplicate job execution | Re-delivered event with different key | Idempotent purge is safe; log duplicate for monitoring |
| Rule name conflict | Duplicate rule name on create | Return RULE_NAME_CONFLICT; enforce UNIQUE constraint |
