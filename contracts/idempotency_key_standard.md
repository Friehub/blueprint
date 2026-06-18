# Module Contract: `idempotency_key_standard`

**Version:** 0.1.0

---

### `idempotency_key_standard`
Idempotency key handling standard for safe retry of state-mutating operations.

**Functions**
```
generateKey(prefix?: string) → string
validateKey(key: string) → ValidationResult
storeResult(key: string, result: any, config?: IdempotencyConfig) → void
getCached(key: string) → IdempotencyRecord | null
```

**Types**
```
IdempotencyConfig { ttl_seconds?: int, scope?: string, idempotent_methods?: string[] }
IdempotencyRecord { key: string, result: any, status: completed | in_progress | expired, created_at: timestamp, expires_at: timestamp, scope: string }
ValidationResult { valid: bool, reason?: string }
```

**Invariants**
- Keys expire after configured TTL (default 24 hours); expired keys are treated as absent
- Same key within TTL must return the same result for the same operation
- A key in `in_progress` status must block concurrent requests with `CONCURRENT_OPERATION`
- Keys must be unique per scope; different scopes may reuse the same key value
- `generateKey` must produce a cryptographically random string with an optional prefix
- `validateKey` must reject empty keys, non-string keys, and keys exceeding 255 characters
- `storeResult` must be atomic; partial writes must not leave dangling locked keys

**Providers:** built-in, Redis, PostgreSQL, DynamoDB, in-memory

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong` for key storage (read-after-write consistency)
* **Details:** Idempotency guarantees depend on the storage backend's consistency; Redis requires WAIT for strong consistency

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once`
* **Details:** Idempotency ensures that duplicate deliveries produce the same result

### Worker Scaling
* **Policy:** Key storage must be shared across all workers; in-memory provider is single-worker only

### Multi-Region Behavior
* **Mode:** Keys are region-scoped by default; global idempotency requires a cross-region storage backend
* **Details:** `scope` field must include region identifier for multi-region deployments

### Backpressure
* If the idempotency store is saturated, the module must return `IDEMPOTENCY_STORE_UNAVAILABLE` rather than hanging

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).
* Idempotency-specific errors: `KEY_EXPIRED`, `CONCURRENT_OPERATION`, `IDEMPOTENCY_STORE_UNAVAILABLE`, `INVALID_KEY_FORMAT`

### Event Emission
```
storeResult     → idempotency.key.stored        { key_prefix, ttl_seconds, scope }
getCached       → idempotency.key.retrieved     { key_prefix, status, age_seconds }
storeResult     → idempotency.key.conflict      { key_prefix, existing_status }
```

### Temporal Constraints
```
Idempotency key retention:
    default_ttl:  24 hours
    min_ttl:      1 minute
    max_ttl:      7 days
    on_expire:    key is treated as absent; operation proceeds normally
```

### Storage Model
* **Model:** KV store with TTL support; the storage backend must support atomic compare-and-set
* **Details:** Keys are stored with a composite key of `scope:key` to support multi-tenant isolation

### Observability
* **Tracing Spans:** Every idempotency operation creates a span. Span names follow `idempotency.<function>`.
* **Telemetry Metrics:**
```
blueprint_idempotency_operation_total           counter { function, result }
blueprint_idempotency_operation_duration_ms     histogram { function }
blueprint_idempotency_keys_active              gauge
blueprint_idempotency_keys_expired_total        counter
blueprint_idempotency_conflicts_total           counter
blueprint_idempotency_errors_total             counter { function, error_code }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** KV store provider
* **Emits To:** events
* **Recommends:** rate_limiter, error_response_standard

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE idempotency_keys (
  key           TEXT NOT NULL,
  scope         TEXT NOT NULL DEFAULT 'default',
  result        JSONB NOT NULL,
  status        TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'in_progress', 'expired')),
  idempotent_method TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (scope, key)
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
CREATE INDEX idx_idempotency_status ON idempotency_keys(scope, status);
```

#### Redis
```
Key pattern: idempotency:{scope}:{key}
Value: JSON serialized IdempotencyRecord
TTL: configurable (default 86400 seconds)
SET NX for atomic create; GET for read
```

### Breaking Change Policy
- Adding new fields to IdempotencyRecord is backward-compatible.
- Changing the key format requires a MAJOR version bump.
- Reducing default TTL is a MINOR change; increasing TTL is backward-compatible.
- Removing the concurrency lock feature requires a MAJOR version bump.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Concurrent request collision | Two requests with same key arrive simultaneously | Second request returns CONCURRENT_OPERATION with retry-after header |
| Store unavailable | Downstream KV backend unreachable | Return IDEMPOTENCY_STORE_UNAVAILABLE; caller may proceed without idempotency |
| Key TTL exceeded under load | Operation takes longer than TTL | Extend TTL on in_progress keys with periodic heartbeat |
| Stale in_progress key | Worker crashed mid-operation | Background reaper marks stuck in_progress keys as expired after 2x TTL |
