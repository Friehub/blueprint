# Module Contract: `credential_rotation_policy`

**Version:** 0.1.0

---

### `credential_rotation_policy`
Credential lifecycle management with rotation schedules, expiry notifications, zero-downtime rotation, and compromise response.

**Functions**
```
registerCredential(name, credential_type, config) → Credential
getCredential(credential_id) → Credential
listCredentials(credential_type?) → Credential[]
rotateCredential(credential_id) → RotationResult
scheduleRotation(credential_id, cron) → void
getRotationHistory(credential_id) → RotationEvent[]
getExpiringCredentials(window_days) → Credential[]
notifyExpiry(credential_id) → void
reportCompromise(credential_id, incident) → CompromiseReport
```

**Types**
```
Credential { id, name, type: api_key|webhook_secret|service_token|oauth_token, max_age_days, status: active|rotating|expired|revoked, created_at, expires_at?, last_rotated_at }
RotationResult { credential_id, previous_version, current_version, created_at, grace_period_end }
RotationEvent { credential_id, version, action: created|rotated|expired|revoked, performed_by, timestamp }
CompromiseReport { credential_id, incident_id, severity, detected_at, rotated_at?, affected_services[] }
RotationConfig { max_age_days, grace_period_minutes, notify_before_days, auto_rotate: bool }
```

**Invariants**
- Rotation must provide a grace period during which both the old and new credential values are accepted -- zero-downtime rotation must not require a deployment or restart
- A credential past `max_age_days` without rotation must be flagged as expired and emit an event
- When a compromise is reported, the credential must be rotated immediately and the old version revoked at the end of the grace period
- Rotation history must be append-only and preserved for audit purposes for a minimum of 1 year
- `notifyExpiry` must fire at `notify_before_days` before expiry, and again at expiry if no rotation has occurred

**Providers:** custom, HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager

**Dependencies:** secrets

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Credential state and versioning must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for rotation and expiry events.
* **Details:** Duplicate rotation events must be idempotent (rotating an already-rotated credential updates the version).

### Worker Scaling
* **Policy:** Expiry checking and notification scheduling must be independently scalable.

### Multi-Region Behavior
* **Mode:** Credential state is global; rotation must propagate to all regions within the grace period.
* **Details:** A credential used in multiple regions must have a grace period long enough for all regions to fetch the new version before the old version is revoked.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
registerCredential  → credential.registered       { credential_id, name, credential_type }
  rotateCredential    → credential.rotated           { credential_id, previous_version, grace_period_end }
  reportCompromise    → credential.compromised       { credential_id, incident_id, severity }
  notifyExpiry        → credential.expiry_warning    { credential_id, days_until_expiry }
  ─                   → credential.expired           { credential_id }
```

### Temporal Constraints
```
Max age defaults:
    api_key:        365 days
    webhook_secret: 365 days
    service_token:  90 days
    oauth_token:    per provider specification
    on_expiry:      emit expired event; flag credential

  Grace period:
    default:        5 minutes
    on_expiry:      old version is revoked; only new version accepted

  Notification schedule:
    first:          30 days before expiry
    second:         7 days before expiry
    final:          at expiry
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `credential_rotation_policy.<function>`.
* **Telemetry Metrics:**
```
gensense_credential_rotation_active_total        { type, status }
  gensense_credential_rotation_rotations_total    { type, result }
  gensense_credential_rotation_expiry_total        { type }
  gensense_credential_rotation_compromise_total    { severity }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** secrets
* **Emits To:** events
* **Recommends:** notifications, scheduled_tasks (for expiry checking), audit_log
