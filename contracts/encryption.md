# Module Contract: `encryption`

---

### `encryption`
Data encryption and key management.

**Functions**
```
encrypt(data, key_id?) → EncryptedData
decrypt(encrypted_data) → string
generateKey(algorithm?) → Key
rotateKey(key_id) → Key
listKeys() → Key[]
archiveKey(key_id) → void
hashPassword(password) → string
verifyPassword(password, hash) → boolean
generateSecret(length?) → string
```

**Types**
```
EncryptedData { ciphertext, key_id, algorithm, iv }
Key { id, algorithm, status, created_at, rotated_at? }
KeyStatus = active | archived | compromised
```

**Invariants**
- `decrypt` must use the `key_id` embedded in `EncryptedData` — key rotation must not break old data
- `hashPassword` must use a memory-hard algorithm (Argon2, bcrypt, scrypt)

**Providers:** AWS KMS, HashiCorp Vault, libsodium, custom

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Standard transactional consistency

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
* None explicitly defined.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `encryption.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none — infrastructure primitive / wraps external provider)
* **Emits To:** events
* **Recommends:** caching, audit_log
