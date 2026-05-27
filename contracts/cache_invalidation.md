# Module: cache_invalidation

**Version:** 0.1.0
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

## System-Level Integrations

- **Idempotency:** Invalidation jobs are idempotent; purging an already-absent key is a no-op at the `caching` layer.
- **Consistency:** This module subscribes to the platform event bus. Rule matching and job dispatch must use an at-least-once delivery model; duplicate events may trigger duplicate jobs, but idempotent purges make this safe.
- **Runtime delivery:** Invalidation jobs are delivered `at_least_once`.
- **Worker scaling:** Purge workers must be independently scalable from event consumption workers.
- **Multi-region:** The module must declare whether invalidation execution is single-region or active/passive; duplicate event processing across regions must be deduplicated.
- **Observability:** Each invalidation job emits a trace span annotated with `ruleId`, `purgedKeyCount`, `failedKeyCount`, and `durationMs`. A metric `cache_invalidation_lag_ms` must be maintained to monitor purge latency from event receipt.
- **Backpressure:** If purge capacity is saturated, matching events must be deferred or queued predictably rather than dropping invalidations silently.
- **Dead-letter handling:** Failed invalidation jobs that exhaust retries must be retained in an operator-queryable failed state with the original rule and key patterns.
- **Storage model:** Rule definitions and invalidation job history must be durably stored; high-volume job history may be trimmed by retention policy, but the active rule set must remain strongly consistent.
- **Dependencies:** `caching` (low-level purge operations), `queues` (event consumption and job dispatch), `config` (cache store configuration references), `audit_log` (manual trigger history).
- **Errors:** `RULE_NOT_FOUND`, `RULE_DISABLED`, `JOB_NOT_FOUND`, `INVALID_KEY_PATTERN`, `CACHE_STORE_UNAVAILABLE`.
- **Providers (adapter examples):** Custom implementation on top of Redis SCAN + DEL, Varnish Cache VCL ban rules, Cloudflare Cache Rules API, Fastly Instant Purge, custom tag-based invalidation (Surrogate-Key).
