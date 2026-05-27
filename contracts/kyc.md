# Module Contract: `kyc`

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
```

**Types**
```
VerificationRequest { id, user_id, status, documents, submitted_at, reviewed_at? }
VerificationStatus = not_started | pending | approved | rejected | expired
DocumentType = passport | national_id | drivers_license | utility_bill | selfie
```

**Providers:** Smile ID, Onfido, Jumio, Sumsub

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
```
submitVerification  → kyc.verification.submitted  { request_id, user_id, document_types }
  approveVerification → kyc.verification.approved   { request_id, user_id }
  rejectVerification  → kyc.verification.rejected   { request_id, user_id, reason }
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
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `kyc.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** users
* **Emits To:** events
* **Recommends:** audit_log, notifications, storage (for document storage)
