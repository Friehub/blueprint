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
* None explicitly defined. Custom events must use the canonical domain envelope.

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
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** users
* **Emits To:** events
* **Recommends:** audit_log, rate_limiting
