# Module Contract: `idempotency_store`

**Version:** 0.1.0

---

### `idempotency_store`
Idempotency key storage and deduplication for ensuring safe retries of state-mutating operations.

**Functions**
```
storeResult(key: any, result: any, ttl_seconds?: number) → IdempotencyRecord
getResult(key: any) → IdempotencyRecord
cleanupExpired() → number
isDuplicate(key: any) → boolean
```

**Types**
```
IdempotencyRecord { idempotency_key: IdempotencyKey, result, version, expires_at, created_at }
IdempotencyKey { key: string, namespace?: string }
```

**Invariants**
- Keys must expire after TTL (24-168h); expired keys must not block new requests
- Stored result shape must include version field; consumers must check version to detect schema changes
- Cleanup must not affect active keys; only entries past `expires_at` may be removed
- A given key must resolve to exactly one result within its TTL window

**Dependencies**
- none

**System-Level Integrations**
- Redis
- Postgres
- DynamoDB

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong` for write operations; `eventual` for expiration.
* **Details:** `storeResult` and `isDuplicate` must agree on the same key within a single request lifecycle.

### Runtime Delivery Model
* **Delivery Guarantee:** `exactly_once` for key creation.
* **Details:** Concurrent writes for the same key must be atomic; second writer must receive the stored result.

### Worker Scaling
* **Policy:** Must be horizontally scalable; key lookups must be O(1) regardless of store size.

### Multi-Region Behavior
* **Mode:** Active/passive with global key replication.
* **Details:** Cross-region duplicate detection must account for replication lag; prefer region-local keys for safety.

### Idempotency Requirements
* **Standard:** All state-mutating functions accept an optional `idempotency_key: string` parameter. Keys must be retained for at least 24 hours.
* **Required Functions:**
  - `storeResult(key, result, ttl_seconds?)`

### Backpressure
* Under load, the store must prioritize write availability over read; stale reads are preferable to failed writes.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
storeResult           → idempotency_store.result.stored          { key, ttl }
cleanupExpired        → idempotency_store.cleanup.completed      { removed_count }
isDuplicate           → idempotency_store.duplicate.checked      { key, is_duplicate }
```

### Temporal Constraints
```
Idempotency key retention:
    ttl:                  24-168 hours (configurable)
    default_ttl:          24 hours
    on_expiry:            auto-cleanup allowed
```

### Storage Model
* **Model:** Key-value store with TTL support.
* **Details:** Keys map to serialized result blobs with version metadata. Expiration is time-based, not reference-counted.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `idempotency_store.<function>`.
* **Telemetry Metrics:**
```
blueprint_idempotency_store_operations_total        counter { function, result }
blueprint_idempotency_store_duplicates_total        counter { namespace }
blueprint_idempotency_store_expired_cleaned_total   counter
blueprint_idempotency_store_latency_ms              histogram { function }
blueprint_idempotency_store_keys_total              gauge
```

### Module Dependencies
* **Depends On:** (none must be dependency-free to avoid circular dependencies)
* **Emits To:** events
* **Recommends:** (none)
* **Pagination Sort Key:** Not applicable; key-value access pattern.

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE idempotency_keys (
  idempotency_key   TEXT NOT NULL,
  namespace         TEXT DEFAULT 'default',
  result            JSONB NOT NULL,
  version           INTEGER NOT NULL DEFAULT 1,
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (namespace, idempotency_key)
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at) WHERE expires_at < now();
```

#### Redis
```
SET {namespace}:{key} {serialized_result} EX {ttl} NX
GET {namespace}:{key}
```

#### DynamoDB
```json
{
  "TableName": "idempotency_keys",
  "KeySchema": [
    { "AttributeName": "namespace", "KeyType": "HASH" },
    { "AttributeName": "idempotency_key", "KeyType": "RANGE" }
  ],
  "TTL": { "AttributeName": "expires_at" }
}
```

### Breaking Change Policy
- Adding new fields to the stored result is additive and backward-compatible.
- Changing the version field interpretation requires a MAJOR version bump.
- Reducing the minimum TTL below 24 hours requires a MAJOR version bump.
- Adding new namespaces is backward-compatible.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Key collision | Two operations with same key | Return existing result; never overwrite |
| Premature expiration | Clock skew between services | Use monotonic clocks; allow skew tolerance |
| Store unavailable | Provider outage | Fail open with isDuplicate=false; risk of duplicate execution |
| Cleanup affects active key | Clock skew in TTL evaluation | Use strict inequality on expires_at vs now() |
| Result schema mismatch | Consumer expects different version | Consumer must check version field before using result |
