# Module Contract: `consent`

**Version:** 0.2.1

---

### `consent`
Privacy consent and GDPR compliance.

**Functions**
```
recordConsent(user_id, purposes, version) → ConsentRecord
getConsent(user_id) → ConsentRecord?
withdrawConsent(user_id, purposes?) → void
hasConsented(user_id, purpose) → boolean
getConsentHistory(user_id) → ConsentRecord[]
exportUserData(user_id) → DataExportJob
deleteUserData(user_id) → DataDeletionJob
getJob(job_id) → ExportOrDeletionJob
```

**Types**
```
ConsentRecord { user_id, purposes: ConsentPurpose[], version, created_at }
ConsentPurpose = analytics | marketing | personalisation | functional
DataExportJob { id, user_id, status, download_url?, expires_at? }
DataDeletionJob { id, user_id, status, completed_at? }
```

**Invariants**
- Consent must be recorded with the policy version at time of consent
- `withdrawConsent` must trigger cascading effects in analytics and marketing modules

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Withdrawal must be immediately honoured

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for consent lifecycle events.
* **Details:** Duplicate consent records with the same `user_id` and `version` must be idempotent.

### Worker Scaling
* **Policy:** Consent recording, withdrawal, and data deletion jobs must be independently scalable.

### Multi-Region Behavior
* **Mode:** Consent records are per-user and global; region-specific consent policies must be declared.
* **Details:** A user's consent preferences must be available in all regions where their data is processed.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* Deletion job queues must apply backpressure when the processing backlog exceeds 10000 jobs per data domain.

### Error Taxonomy
### Module-Specific Errors
```
recordConsent:
    invalid_purpose:           Purpose is not in the current consent version | update to latest version
    version_mismatch:          Consent version does not match the current policy version | prompt user to accept latest

  withdrawConsent:
    no_consent_found:          No consent record exists for this user | no action needed

  exportUserData:
    export_in_progress:        An export job is already running for this user | return existing job_id
    no_data_found:             No personal data exists for this user | return empty export

  deleteUserData:
    deletion_in_progress:      A deletion job is already running for this user | return existing job_id
    legal_hold_active:         User data is under legal hold | cannot delete; return 403
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
recordConsent     → consent.granted            { user_id, purposes, version }
  withdrawConsent   → consent.withdrawn          { user_id, purposes }
  deleteUserData    → consent.data_deletion.requested { user_id, job_id }
                    OR consent.data_deletion.completed   { user_id, job_id }
                    OR consent.data_deletion.failed      { user_id, job_id, reason }
  exportUserData    → consent.data_export.requested  { user_id, job_id }
                    OR consent.data_export.completed   { user_id, job_id }
```

### Temporal Constraints
```
Data deletion job timeout:
    default:        72 hours
    on_expiry:      mark job as failed; notify operator

  Data export URL expiry:
    duration:       7 days
    on_expiry:      regenerate URL; original invalidated

  Consent version retention:
    duration:       minimum 5 years (GDPR requirement)
    on_expiry:      eligible for archival after compliance audit window
```

### Storage Model
* **Model:** Strongly consistent consent record store with append-only history.
* **Details:** Consent records must be immediately consistent. Withdrawal must cascade to dependent modules via event-driven handlers.

### Database Schema

#### PostgreSQL
```sql
CREATE TYPE consent_purpose AS ENUM ('analytics', 'marketing', 'personalisation', 'functional');

CREATE TABLE consent_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  purposes        consent_purpose[] NOT NULL,
  version         INT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_consent_user ON consent_records(user_id);
CREATE INDEX idx_consent_user_version ON consent_records(user_id, version DESC);

CREATE TABLE consent_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  action          TEXT NOT NULL CHECK (action IN ('granted', 'withdrawn', 'updated')),
  purposes        consent_purpose[] NOT NULL,
  version         INT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_consent_history_user ON consent_history(user_id, created_at DESC);

CREATE TABLE consent_data_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  job_type        TEXT NOT NULL CHECK (job_type IN ('export', 'deletion')),
  status          TEXT NOT NULL DEFAULT 'pending',
  download_url    TEXT,
  expires_at      TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_consent_jobs_status ON consent_data_jobs(status, created_at) WHERE status = 'pending';
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `consent.<function>`.
* **Telemetry Metrics:**
```
blueprint_consent_records_total               { action }
  blueprint_consent_withdrawals_total           { purpose }
  blueprint_consent_data_jobs_total             { job_type, status }
  blueprint_consent_deletion_duration_ms         histogram
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** users
* **Emits To:** events
* **Recommends:** audit_log, queues (for data deletion jobs), analytics (for consent-gated tracking)
