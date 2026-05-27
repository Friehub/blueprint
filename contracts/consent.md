# Module Contract: `consent`

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

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
recordConsent     → consent.granted            { user_id, purposes, version }
  withdrawConsent   → consent.withdrawn          { user_id, purposes }
  deleteUserData    → consent.data_deletion.requested { user_id, job_id }
```

### Temporal Constraints
* None explicitly defined.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `consent.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** users
* **Emits To:** events
* **Recommends:** audit_log, queues (for data deletion jobs), analytics (for consent-gated tracking)
