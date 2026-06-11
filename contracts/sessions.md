# Module Contract: `sessions`

**Version:** 0.1.0

---

### `sessions`
Session lifecycle management separate from auth tokens.

**Functions**
```
createSession(user_id, device_info?) → Session
getSession(session_id) → Session?
getSessions(user_id) → Session[]
revokeSession(session_id) → void
revokeAllSessions(user_id) → void
extendSession(session_id) → Session
```

**Types**
```
Session { id, user_id, device, ip_address?, created_at, last_active_at, expires_at, status: partial|active|suspicious }
```

**Invariants**
- Revoked sessions must not be reactivated
- `getSessions` must return active sessions only unless `include_revoked: true` is passed
- Session cookies must set `SameSite` to `Strict` or `Lax`, `HttpOnly`, and `Secure` when the connection is over HTTPS
- A session identifier must be regenerated on authentication completion and on every privilege escalation (MFA completion, role elevation, tenant switch)
- When a request arrives using a session token and the request context differs materially from the session's creation context, the module must set `status` to `suspicious` and emit an event consumable by `security_monitoring` and `fraud_detection`. A material difference includes: country change, device class change, or simultaneous use from two geographically distant locations. The definition of material difference must be a configurable policy.
- Access tokens must be bound to the TLS session or to a device fingerprint at issuance. A token presented from a different TLS session or device fingerprint than the one it was issued to must be rejected regardless of whether the token has expired.

**Providers:** Redis, database, JWT stores

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Revoked sessions must be rejected immediately

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for session lifecycle events.
* **Details:** Duplicate session creation retries must not create multiple active sessions unless the contract explicitly allows them.

### Worker Scaling
* **Policy:** Session validation and cleanup jobs must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether sessions are single-region or active/passive.
* **Details:** Revocation state must converge across regions before a session is accepted.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If session churn is saturated, create/refresh/revoke operations must defer or reject predictably rather than leaving sessions in an indeterminate state.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
```
Session (active):
    inactivity_timeout: 30 minutes (configurable)
    on_expiry:          transition to expired
                        emit auth.session.expired
    absolute_timeout:   24 hours regardless of activity
```

### Storage Model
* **Model:** Durable session store or revocation cache backed by persistent identity state.
* **Details:** Revocation must remain queryable for the full refresh-token validity window.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `sessions.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events
* **Recommends:** caching (for session storage), audit_log
