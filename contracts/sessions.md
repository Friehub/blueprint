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
listActiveSessions(user_id) → Session[]
revokeSession(session_id) → void
revokeAllSessions(user_id) → void
extendSession(session_id) → Session
```

**Types**
```
Session { id, user_id, device, device_fingerprint?, ip_address?, created_at, last_active_at, expires_at, status: partial|active|suspicious }
```

**Invariants**
- Revoked sessions must not be reactivated
- `getSessions` must return active sessions only unless `include_revoked: true` is passed
- `createSession` must capture a device fingerprint from the request context. A device fingerprint is a SHA-256 hash of (user_agent, accept_language, screen_resolution, platform, timezone). If fingerprinting data is unavailable, the session is created in `suspicious` status.
- `listActiveSessions(user_id)` returns only sessions with status `active`, ordered by `last_active_at DESC`. Used for "active sessions" UX.
- Maximum concurrent sessions per user: 10 (configurable). `createSession` when at the limit must revoke the least-recently-active session before creating the new one. The revoked session emits an event with reason `displaced_by_new_session`.
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
```
createSession        → session.created                  { session_id, user_id, device_info }
extendSession        → session.extended                 { session_id, user_id, new_expires_at }
revokeSession        → session.revoked                  { session_id, user_id, revoked_by }
revokeAllSessions    → session.all_revoked              { user_id, revoked_by }
                     → session.expired                  { session_id, user_id, reason: inactivity|absolute }
suspicious_detected  → session.suspicious               { session_id, user_id, anomaly }
```

### Database Schema

#### Redis (Primary Session Store)
```
Session Hash:
  Key:    session:{session_id}
  Fields: user_id, device_info, ip_address, created_at, last_active_at,
          expires_at, status

Session Index (per user):
  Key:    user_sessions:{user_id}
  Type:   Set
  Members: session_id values (active sessions only)

Revocation Set:
  Key:    revoked_sessions
  Type:   Set (with TTL)
  Members: session_id values revoked within retention window

Device Fingerprint Index:
  Key:    device_fingerprint:{fingerprint}
  Type:   Set
  Members: user_id values (for suspicious activity detection)
```

#### PostgreSQL (Revocation & Audit Trail)
```sql
CREATE TABLE session_audit (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL,
  user_id     UUID NOT NULL,
  action      TEXT NOT NULL CHECK (action IN ('created', 'extended', 'revoked', 'expired')),
  ip_address  INET,
  user_agent  TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_audit_user ON session_audit(user_id, created_at DESC);
CREATE INDEX idx_session_audit_session ON session_audit(session_id);

CREATE TABLE session_revocations (
  session_id  UUID PRIMARY KEY,
  user_id     UUID NOT NULL,
  revoked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_by  TEXT NOT NULL DEFAULT 'user'
                CHECK (revoked_by IN ('user', 'admin', 'system', 'security')),
  reason      TEXT,
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_revocations_user ON session_revocations(user_id, revoked_at DESC);
```

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
* **Telemetry Metrics:**
```
blueprint_sessions_operation_total        counter { function, result: success|failure }
blueprint_sessions_operation_duration_ms  histogram { function, p50, p95, p99 }
blueprint_sessions_errors_total           counter { function, error_code }
blueprint_sessions_active_total           gauge { user_id? }
blueprint_sessions_revoked_total          counter { reason: user|admin|security|expired }
blueprint_sessions_suspicious_total       counter
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

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

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events
* **Recommends:** caching (for session storage), audit_log
