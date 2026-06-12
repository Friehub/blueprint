# Module: config

**Version:** 0.1.0
**Part:** III -- Data and State

## Purpose

Defines the interface for managing runtime application configuration. A configuration entry is a named key-value pair that controls application behaviour at runtime, without requiring a code deployment. This module is distinct from `feature_flags`, which manages boolean on/off toggles with user-segment targeting. Config manages structured, typed, non-binary values -- timeouts, limits, service endpoints, rate values, and algorithm parameters -- that must be changeable at runtime across a distributed system.

---

## State Machine

### Entry State
```
ACTIVE → DEPRECATED → DELETED
ACTIVE → ARCHIVED
```

### Change State
```
DRAFT → PENDING_APPROVAL → APPROVED → APPLIED
                         → REJECTED
DRAFT → APPLIED           (if approval is not required for this key)
APPLIED → ROLLED_BACK
```

Transitions:
- `ACTIVE`: entry is the live, resolved value for its key
- `DEPRECATED`: key is still readable but callers are warned via observability
- `DRAFT → APPLIED`: direct apply when the key does not require approval
- `DRAFT → PENDING_APPROVAL`: key is marked `requiresApproval = true`
- `APPROVED → APPLIED`: approver signs off; new value propagates
- `APPLIED → ROLLED_BACK`: `rollback` called; previous value is restored

---

## Functions

### `setConfig(input: SetConfigInput) → ConfigEntry`
Creates or updates a configuration key. If the key is marked `requiresApproval`, the change enters `PENDING_APPROVAL` state and does not take effect immediately.

### `getConfig(key: ConfigKey) → ConfigEntry`
Returns the current resolved value for a key. This is the hot path -- must be low-latency and cacheable.

### `getConfigs(keys: ConfigKey[]) → ConfigEntry[]`
Batch read for multiple keys. Returns an entry per key; missing keys return a typed absence, not an error.

### `listConfigs(input: ListConfigsInput) → PaginatedList<ConfigEntry>`
Returns all configuration entries, optionally filtered by namespace, type, or status.

### `approveChange(changeId: ConfigChangeId) → ConfigChange`
Approves a pending change and applies it immediately. Only available if the key requires approval.

### `rejectChange(changeId: ConfigChangeId, reason: string) → ConfigChange`
Rejects a pending change. The current value is unchanged.

### `rollback(key: ConfigKey) → ConfigEntry`
Restores the previous value for a key. Only valid if the key has a prior version.

### `getHistory(key: ConfigKey) → ConfigChange[]`
Returns the full ordered change history for a key, newest first.

### `deleteConfig(key: ConfigKey) → void`
Removes a configuration entry. Callers reading the key after deletion receive `CONFIG_NOT_FOUND`.

### `validateConfig(input: ValidateConfigInput) → ValidationResult`
Validates a proposed value against the key's declared type and constraint schema without applying it.

---

## Types

```typescript
type ConfigKey = string;           // Namespaced key, e.g. "payments.timeout_ms", "auth.session_ttl_seconds"
type ConfigChangeId = string;

type ConfigType =
  | "STRING"
  | "NUMBER"
  | "BOOLEAN"
  | "JSON"
  | "SECRET";                      // SECRET values are encrypted at rest and redacted in logs

type ChangeStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "APPLIED" | "ROLLED_BACK";

type EntryStatus = "ACTIVE" | "DEPRECATED" | "ARCHIVED" | "DELETED";

type ConfigConstraint = {
  minValue?: number;
  maxValue?: number;
  allowedValues?: unknown[];
  pattern?: string;                // Regex pattern for STRING type validation
  jsonSchema?: Record<string, unknown>;
};

type ConfigEntry = {
  key: ConfigKey;
  namespace: string;               // Derived from key prefix (e.g. "payments")
  type: ConfigType;
  value: unknown;                  // Typed at runtime per the `type` field; SECRET values are redacted
  description?: string;
  status: EntryStatus;
  requiresApproval: boolean;
  constraints?: ConfigConstraint;
  version: number;
  lastChangedAt: Timestamp;
  lastChangedBy: UserId;
};

type ConfigChange = {
  changeId: ConfigChangeId;
  key: ConfigKey;
  previousValue?: unknown;
  newValue: unknown;
  status: ChangeStatus;
  requestedBy: UserId;
  requestedAt: Timestamp;
  approvedBy?: UserId;
  approvedAt?: Timestamp;
  rejectedBy?: UserId;
  rejectedAt?: Timestamp;
  rejectionReason?: string;
  appliedAt?: Timestamp;
};

type SetConfigInput = {
  key: ConfigKey;
  type: ConfigType;
  value: unknown;
  description?: string;
  requiresApproval?: boolean;
  constraints?: ConfigConstraint;
  requestedBy: UserId;
};

type ListConfigsInput = {
  namespace?: string;
  type?: ConfigType;
  status?: EntryStatus;
  requiresApproval?: boolean;
  pagination: PaginationInput;
};

type ValidateConfigInput = {
  key: ConfigKey;
  value: unknown;
};

type ValidationResult = {
  valid: boolean;
  errors: string[];
};
```

---

## Invariants

1. `SECRET` type values must never appear in plaintext in logs, events, or API responses; they must be redacted to `"[REDACTED]"` in all observable outputs.
2. `getConfig` must be served from a local cache with a maximum staleness of 5 seconds; it must never block on a network call in the hot path.
3. A key's `type` is immutable after creation; changing the type requires deleting and re-creating the key.
4. `rollback` is only valid if `getHistory` would return at least two entries (a current and a prior version).
5. `setConfig` on an existing key with `requiresApproval = true` must not apply the change immediately; it must create a `ConfigChange` in `PENDING_APPROVAL` state.
6. Constraint validation runs at write time (`setConfig`) and at `validateConfig` time; a value that violates the constraint must be rejected with a `CONSTRAINT_VIOLATION` error.
7. Namespaces are derived automatically from the key prefix up to the first `.`; they are not independently created.
8. All changes are append-only records; no change record may be mutated or deleted after creation.
9. **Schema validation:** Every value written via `setConfig` must be validated against its declared type and `constraints` before persisting. `STRING` values are validated against `pattern` if set. `NUMBER` values are validated against `minValue`/`maxValue`. `JSON` values are validated against `jsonSchema`. Violations return `CONSTRAINT_VIOLATION` with field-level errors.
10. **Secret references:** A `SECRET` type value may contain a reference string in the format `secret://<provider>/<path>`, e.g. `secret://aws/secretsmanager/payments/api_key`. The reference is resolved at read time by the configured secrets provider. The resolved value must never be cached in the config cache — only the reference string is cached. If the secrets provider is unreachable at read time, the module must return the cached reference (not the cached resolved value) and emit a warning.
11. **Hot-reload propagation:** When a config value transitions to `APPLIED` state, the module must broadcast an invalidation notification to all running instances via the configured message bus. Instances must refresh their local cache upon receiving the notification. If the broadcast fails, the cache naturally expires within the 5-second staleness window. No service restart is required for any config change — all changes take effect at runtime.

---

## Events Emitted

- `config.set` -- new key created
- `config.updated` -- existing key value changed; includes `previousValue` (redacted if SECRET)
- `config.change.pending_approval`
- `config.change.approved`
- `config.change.rejected`
- `config.rolled_back` -- includes `restoredVersion`
- `config.deprecated`
- `config.deleted`

---

## System-Level Integrations

- **Idempotency:** `setConfig` with an identical `(key, value)` to the current applied value is a no-op; it returns the existing entry without creating a change record.
- **Consistency:** Changes must be written atomically with their audit records. The cache must be invalidated within 5 seconds of an `APPLIED` change via a pub/sub notification; stale reads beyond this window are a contract violation.
- **Runtime delivery:** Config change notifications are delivered `at_least_once`.
- **Worker scaling:** Config reads and change application / approval workflows must be independently scalable.
- **Multi-region:** The deployment must declare whether configuration is single-region or multi-region replicated; change propagation lag must be documented.
- **Observability:** Access to `DEPRECATED` keys must emit a warning-level span annotation with the key name; this enables deprecation tracking without breaking callers.
- **Backpressure:** If config propagation is saturated, updates must queue or reject predictably rather than leaving the cache in an indeterminate state.
- **Storage model:** The source of truth for configuration must be durable; the cache is an acceleration layer only.
- **Dependencies:** `caching` (hot-path read layer), `queues` or `events` (cache invalidation broadcast), `audit_log` (change history), `approvals` (for keys requiring approval flows), `encryption` (SECRET value storage).
- **Errors:** `CONFIG_NOT_FOUND`, `CONSTRAINT_VIOLATION`, `TYPE_IMMUTABLE`, `CHANGE_NOT_FOUND`, `CHANGE_NOT_PENDING`, `ROLLBACK_NOT_AVAILABLE`, `APPROVAL_REQUIRED`.
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

- **Providers (adapter examples):** AWS AppConfig, LaunchDarkly (config layer), HashiCorp Consul, etcd, custom PostgreSQL-backed implementation.
