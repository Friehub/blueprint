# Module Contract: `credential_rotation_policy`

**Version:** 0.2.0

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
### Module-Specific Errors
```
registerCredential:
    credential_already_exists:  A credential with this name and type already exists | use a different name
    unsupported_type:           Credential type is not supported | use a supported type

  rotateCredential:
    credential_expired:         Credential is past max_age_days without rotation | rotate immediately
    already_rotating:           Credential is already in rotating state | wait for rotation to complete
    provider_error:             Secret provider returned an error during rotation | check provider health

  reportCompromise:
    credential_not_found:       No credential with that ID | verify credential_id
    already_rotated:            Credential was already rotated after compromise | verify incident timeline

  getExpiringCredentials:
    invalid_window:             window_days must be positive | use a valid window

  scheduleRotation:
    already_scheduled:          Rotation already scheduled for this credential | update existing schedule
```

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
blueprint_credential_rotation_active_total        { type, status }
  blueprint_credential_rotation_rotations_total    { type, result }
  blueprint_credential_rotation_expiry_total        { type }
  blueprint_credential_rotation_compromise_total    { severity }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Storage Model
* **Model:** Strongly consistent credential metadata store with append-only rotation history.
* **Details:** Credential metadata (name, type, status, version) is strongly consistent. Rotation history is append-only. Actual secret values are stored in the secrets module.

### Database Schema

#### PostgreSQL
```sql
CREATE TYPE credential_status AS ENUM ('active', 'rotating', 'expired', 'revoked');

CREATE TABLE credential_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  credential_type TEXT NOT NULL CHECK (credential_type IN ('api_key', 'webhook_secret', 'service_token', 'oauth_token')),
  status          credential_status NOT NULL DEFAULT 'active',
  max_age_days    INT NOT NULL,
  current_version TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ,
  last_rotated_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_cred_registry_name ON credential_registry(name);

CREATE TABLE credential_rotation_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id   UUID NOT NULL REFERENCES credential_registry(id) ON DELETE CASCADE,
  version         TEXT NOT NULL,
  action          TEXT NOT NULL CHECK (action IN ('created', 'rotated', 'expired', 'revoked')),
  performed_by    TEXT NOT NULL,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cred_history_credential ON credential_rotation_history(credential_id, timestamp DESC);

CREATE TABLE credential_compromises (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id   UUID NOT NULL REFERENCES credential_registry(id) ON DELETE CASCADE,
  incident_id     TEXT NOT NULL,
  severity        TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  detected_at     TIMESTAMPTZ NOT NULL,
  rotated_at      TIMESTAMPTZ,
  affected_services JSONB NOT NULL DEFAULT '[]'
);
```

### Module Dependencies
* **Depends On:** secrets
* **Emits To:** events
* **Recommends:** notifications, scheduled_tasks (for expiry checking), audit_log
