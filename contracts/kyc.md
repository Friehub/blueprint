# Module Contract: `kyc`

**Version:** 0.1.0

---

### `kyc` (Fintech, Regulated Industries)
Know Your Customer identity verification.

**Functions**
```
submitVerification(user_id, documents, data) → VerificationRequest
getVerification(request_id) → VerificationRequest
getUserVerification(user_id) → VerificationRequest?
getVerificationStatus(user_id) → VerificationStatus
updateVerification(request_id, data) → VerificationRequest
rejectVerification(request_id, reason) → VerificationRequest
approveVerification(request_id) → VerificationRequest
listPendingVerifications(options?) → PaginatedResult<VerificationRequest>
expireVerification(request_id) → VerificationRequest
```

**Types**
```
VerificationRequest { id, user_id, status, documents, data, submitted_at, reviewed_at?, expires_at }
VerificationStatus = not_started | pending | approved | rejected | expired
DocumentType = passport | national_id | drivers_license | utility_bill | selfie
```

**Invariants**
- `submitVerification` must reject if an active `pending` or `approved` verification exists for the same `user_id` — return `DUPLICATE_VERIFICATION` with the existing `request_id`.
- `approveVerification` must only transition from `pending` — calling it on an already `approved` or `expired` request returns `INVALID_TRANSITION`.
- `rejectVerification` must include a non-empty `reason` string — rejections without a reason are a contract violation.
- Verification expiry must be enforced by a scheduled job — `getVerificationStatus` must treat expired records as `expired` even if the DB row still says `approved`.
- Document references in `documents` must point to valid entries in the `storage` module — orphan document references are a contract violation.
- `listPendingVerifications` must only return records with status `pending` — records expiring within the next hour must be returned with an `expires_soon` flag.

**Providers:** Smile ID, Onfido, Jumio, Sumsub

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Standard transactional consistency

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for verification lifecycle events.
* **Details:** Duplicate submission or approval retries must not create duplicate active verification requests.

### Worker Scaling
* **Policy:** Document ingestion, review, and status query workloads must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether verification is single-region or active/passive.
* **Details:** Cross-region review state must converge before approval is accepted.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If review or provider capacity is saturated, verification actions must defer or reject predictably rather than leaving ambiguous status.

### Error Taxonomy
### Module-Specific Errors
```
submitVerification:
    duplicate_verification:   Active verification already exists for this user | return existing request_id
    invalid_document:         Document type not accepted or file corrupt | validate before submission

  approveVerification:
    invalid_transition:       Cannot approve from current status | verify request is in pending state
    verification_expired:     Request expired before approval | user must resubmit

  rejectVerification:
    reason_required:          Rejection reason must be provided | include non-empty reason string
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
submitVerification    → kyc.verification.submitted  { request_id, user_id, document_types }
approveVerification   → kyc.verification.approved   { request_id, user_id }
rejectVerification    → kyc.verification.rejected   { request_id, user_id, reason }
expireVerification    → kyc.verification.expired    { request_id, user_id }
```

### Temporal Constraints
```
VerificationRequest (pending):
    max_duration:    5 business days
    on_expiry:       transition to expired
                     notify user to resubmit

  VerificationRequest (approved):
    validity:        2 years (configurable by regulation)
    on_expiry:       transition to expired
                     require re-verification for regulated operations

  Verification daily expiry sweep:
    schedule:        every 6 hours
    on_expiry:       batch-expire all records past their expiry date
```

### Storage Model
* **Model:** Durable verification record store.

#### PostgreSQL
```sql
CREATE TYPE verification_status AS ENUM ('not_started', 'pending', 'approved', 'rejected', 'expired');

CREATE TABLE verification_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  status          verification_status NOT NULL DEFAULT 'pending',
  documents       JSONB NOT NULL,
  data            JSONB,
  reason          TEXT,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '2 years',
  idempotency_key TEXT UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_verification_active_user ON verification_requests(user_id) WHERE status = 'pending' OR status = 'approved';
CREATE INDEX idx_verification_status ON verification_requests(status) WHERE status = 'pending';
CREATE INDEX idx_verification_expiry ON verification_requests(expires_at) WHERE status = 'approved';
```
* **Details:** Submitted documents must be retained per regulation and access policy; document storage is delegated to `storage`.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `kyc.<function>`.
* **Telemetry Metrics:**
```
blueprint_kyc_operations_total           { function, result }
blueprint_kyc_operation_duration_ms      histogram { function }
blueprint_kyc_verification_status        gauge { status }
blueprint_kyc_verification_expiry_count  gauge
blueprint_kyc_errors_total               { code }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return provider_error, do not retry indefinitely |
| Provider rate limited | Respect Retry-After header, apply exponential backoff |
| Duplicate verification submission | Return duplicate_verification with existing request_id |
| Provider unavailable for document check | Return provider_error; keep verification in pending state |

### Breaking Change Policy
- Adding a new document type enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise
- Removing a verification status enum value: breaking — requires major version bump and migration guide
- Changing verification expiry from fixed to configurable: non-breaking
- Adding a new required field to VerificationRequest: breaking

### Module Dependencies
* **Depends On:** users
* **Emits To:** events
* **Recommends:** audit_log, notifications, storage (for document storage)
