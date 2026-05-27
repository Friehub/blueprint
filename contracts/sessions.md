# Module Contract: `sessions`

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
Session { id, user_id, device, ip_address?, created_at, last_active_at, expires_at }
```

**Invariants**
- Revoked sessions must not be reactivated
- `getSessions` must return active sessions only unless `include_revoked: true` is passed

**Providers:** Redis, database, JWT stores

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Revoked sessions must be rejected immediately

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

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

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `sessions.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events
* **Recommends:** caching (for session storage), audit_log
