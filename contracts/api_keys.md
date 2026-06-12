# Module Contract: `api_keys`

**Version:** 0.1.0

---

### `api_keys`
Programmatic access credentials.

**Functions**
```
createApiKey(user_id, name, scopes, expires_at?) → ApiKey
getApiKey(key_id) → ApiKey
listApiKeys(user_id) → ApiKey[]
revokeApiKey(key_id) → void
validateApiKey(raw_key) → ApiKeyValidation
rotateApiKey(key_id) → ApiKey
```

**Types**
```
ApiKey { id, user_id, name, prefix, scopes, last_used_at?, expires_at?, created_at }
ApiKeyValidation { valid, user_id?, scopes?, reason? }
```

**Invariants**
- The raw key must only be returned at creation time, never again
- `validateApiKey` must update `last_used_at` without blocking the response
- Generated keys must have a minimum entropy of 128 bits. Keys must be encoded using base64url or hex format.
- Every generated key must include a mandatory prefix that identifies the key type (e.g. `sk_live_` for live secret keys, `pk_test_` for test publishable keys). The prefix scheme must allow programmatic distinction between credential types and enable GitHub secret scanning pattern matching.
- Key material must be stored using a slow, key-stretching hashing algorithm (bcrypt with cost >= 10, scrypt, or Argon2id). Fast hashes (SHA-256, MD5) are not acceptable for key storage.

---

## Part II -- Communication

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Revoked keys must be rejected immediately

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for API key lifecycle events.
* **Details:** Duplicate create/rotate retries must not leak additional raw keys.

### Worker Scaling
* **Policy:** Key validation and rotation workflows must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether API key validation is single-region or active/passive.
* **Details:** Revocation state must converge across regions before a key is accepted.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If validation or rotation capacity is saturated, the module must defer or reject predictably rather than issuing ambiguous credentials.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createApiKey     → api_keys.key.created        { key_id, user_id, scopes, prefix }
revokeApiKey     → api_keys.key.revoked        { key_id, user_id }
rotateApiKey     → api_keys.key.rotated        { key_id, user_id }
                 → api_keys.key.expiring_soon  { key_id, user_id, expires_at }  (7 days before expiry)
```

### Temporal Constraints
```
ApiKey (with expires_at set):
    on_expiry:      transition to expired
                    validateApiKey returns { valid: false, reason: "expired" }
    warning:        7 days before expiry -- emit api_key.expiring_soon to owner
```

### Storage Model
* **Model:** Durable key registry with revocation index.
* **Details:** Raw secrets must be shown only once at creation; the stored record must retain only the non-secret metadata needed for validation.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `api_keys.<function>`.
* **Telemetry Metrics:**
```
gensense_api_keys_operation_total               counter { function, result }
gensense_api_keys_operation_duration_ms         histogram { function }
gensense_api_keys_errors_total                  counter { function, error_code }
gensense_api_keys_keys_total                     gauge { status }
gensense_api_keys_validations_total              counter { result }
gensense_api_keys_rotations_total                counter
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** users
* **Emits To:** events
* **Recommends:** audit_log, rate_limiting

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  prefix          TEXT NOT NULL,
  key_hash        TEXT NOT NULL,
  key_type        TEXT NOT NULL DEFAULT 'secret'
                    CHECK (key_type IN ('secret', 'publishable')),
  environment     TEXT NOT NULL DEFAULT 'live'
                    CHECK (environment IN ('live', 'test')),
  scopes          TEXT[] NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'revoked', 'expired', 'rotated')),
  last_used_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id, status);
CREATE INDEX idx_api_keys_prefix ON api_keys(prefix);
CREATE INDEX idx_api_keys_expiry ON api_keys(expires_at) WHERE status = 'active' AND expires_at IS NOT NULL;

CREATE TABLE api_key_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id      UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  action          TEXT NOT NULL CHECK (action IN ('created', 'revoked', 'rotated', 'expired', 'validated')),
  actor_id        UUID,
  ip_address      INET,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_key_audit_key ON api_key_audit(api_key_id, created_at DESC);
```

### Storage Model
* **Model:** Durable key registry with revocation index.
* **Details:** Raw secrets must be shown only once at creation; the stored record retains only the non-secret metadata and a bcrypt/Argon2id hash needed for validation.

### Breaking Change Policy
- Adding a new key type or environment value is additive and backward-compatible.
- Removing or renaming an existing key type requires a MAJOR version bump.
- Changing the hashing algorithm requires a MAJOR version bump (existing hashes become invalid).
- Adding new required fields to `createApiKey` input requires a MAJOR version bump.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Key hash collision | Truncated hash from weak algorithm | Use full hash output; log if collision detected |
| Raw key leaked after creation | Stored in server log | Mask raw key immediately after return; never log key material |
| Revocation propagation delay | Multi-region replication lag | Use strong consistency for validateApiKey reads; reject if status not confirmed |
| Expired key accepted | Clock skew between services | Validate expiry using UTC clock; allow 30-second grace period |
| Rotate returns same key | Concurrency race on rotation | Serialize rotation per key_id; log warning on duplicate |
