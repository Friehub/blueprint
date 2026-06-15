# Module Contract: `idempotency_layer`

**Version:** 0.1.0

---

### `idempotency_layer`
Standalone reusable idempotency pattern — key generation, storage, lookup-before-execute, and result caching.

**Functions**
```
createIdempotencyKey(namespace, scope, seed?) → IdempotencyKey
checkIdempotency(key) → IdempotencyResult
registerAttempt(key, operation_type, args_hash) → AttemptRegistration
completeAttempt(key, result) → IdempotencyResult
failAttempt(key, error) → IdempotencyResult
getStaleKeys(older_than_hours) → IdempotencyKey[]
releaseStaleKeys(keys) → number
```

**Types**
```
IdempotencyKey { id, namespace, scope, created_at, ttl_seconds: 604800 }
IdempotencyResult { is_new: bool, status: in_progress | completed | failed, result?, error?, completed_at? }
AttemptRegistration { key, status: in_progress, created_at, expires_at }
StaleKeyPolicy { max_age_hours: 168, cleanup_interval_minutes: 60, on_expiry: release | retain }
```

**Invariants**
- `checkIdempotency` + `registerAttempt` + `completeAttempt` must be atomic — no window for duplicate execution
- Duplicate keys must return the original result, not an error
- Keys auto-expire after 7 days (604800 seconds) — configurable per namespace
- Concurrent requests with the same key must not both execute; one wins, the other waits or receives `in_progress`
- The `in_progress` state must have a timeout (default 30s) to release locks on crashed handlers
- Stale key cleanup must not affect active keys — soft delete only

**Providers:** Redis, Postgres (advisory locks), DynamoDB (conditional writes)

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong` for key check + registration (must be atomic)
* **Details:** Use database-level uniqueness constraint or distributed lock

### Storage Model
* **Storage:** Idempotency key table with 7-day TTL, composite primary key (namespace, key_id)
* **Details:** Result payloads over 64KB should be stored in a separate blob store referenced by the key

### Module Dependencies
* **Hard Dependencies:** `caching` (for key storage)
* **Soft Dependencies:** none

### Referenced By
* `payments`, `transfers`, `orders`, `notifications`, and any module requiring at-most-once semantics
