# Module Contract: `right_to_erasure`

**Version:** 0.2.0

---

### `right_to_erasure`
Cross-service user data deletion with certification and notification (GDPR Article 17).

**Functions**
```
requestErasure(user_id, reason, requested_by) → ErasureRequest
getErasureRequest(request_id) → ErasureRequest
listErasureRequests(status?) → ErasureRequest[]
identifyDataSources(user_id) → DataSourceMap
executeErasure(request_id) → ErasureResult
certifyDeletion(request_id) → Certification
notifyDataRecipients(request_id) → NotificationResult
cancelRequest(request_id, reason) → void
```

**Types**
```
ErasureRequest { id, user_id, reason, requested_by, status: pending|identifying|executing|certifying|completed|failed, created_at }
DataSourceMap { user_id, services: ServiceData[], total_services, identified_at }
ServiceData { service_name, data_category, record_count, deletion_method: hard_delete|anonymize|mask, status: pending|completed|failed }
ErasureResult { request_id, services_processed, records_deleted, records_anonymized, errors: ServiceError[] }
Certification { request_id, certified_by, certified_at, services_confirmed: string[], method, expires_at }
NotificationResult { request_id, recipients_notified, total_recipients, failed_recipients[] }
ServiceError { service, reason, manual_intervention_required }
```

**Invariants**
- `identifyDataSources` must return every service that holds data for the user -- omitting a service is a compliance violation
- Data in a service with a legal hold must be excluded from erasure and reported in the result as `legal_hold_active`
- `certifyDeletion` must include confirmation from every service that holds user data before certification is valid

**Providers:** custom (orchestration layer over individual service deletion endpoints)

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Erasure request state must be immediately consistent to track multi-service progress

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for erasure execution events.
* **Details:** Duplicate erasure commands to a service must be idempotent (user already deleted → no-op).

### Worker Scaling
* **Policy:** Data source identification, erasure execution, and certification must be independently scalable.

### Multi-Region Behavior
* **Mode:** Erasure must propagate to all regions where the user's data exists.
* **Details:** Cross-region erasure must complete before certification; partial regional erasure is a failure.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
### Module-Specific Errors
```
requestErasure:
    request_exists:         Active erasure request already exists for this user | return existing request
    legal_hold_active:      User data is under legal hold | erasure cannot proceed until hold is released

  executeErasure:
    service_unavailable:    A data source service is unreachable | retry or require manual intervention
    partial_failure:        Some services failed to delete data | check ServiceError list and retry failed services
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
requestErasure    → erasure.requested            { request_id, user_id, reason }
  identifyDataSources → erasure.sources_identified  { request_id, services_count }
  executeErasure    → erasure.executed             { request_id, records_deleted }
                   OR erasure.execution_failed     { request_id, errors }
  certifyDeletion   → erasure.certified            { request_id, certified_by }
```

### Temporal Constraints
```
Erasure execution timeout:
    default:        72 hours (GDPR Article 12 requires response within one month)
    on_expiry:      flag for escalation; may require regulatory notification

  Certification expiry:
    duration:       1 year
    on_expiry:      recertification recommended for audit readiness
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `right_to_erasure.<function>`.
* **Telemetry Metrics:**
```
blueprint_right_to_erasure_requests_total           { status }
  blueprint_right_to_erasure_records_deleted_total   { service }
  blueprint_right_to_erasure_certifications_total
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** users, audit_log
* **Emits To:** events
* **Recommends:** notifications, data_retention, consent
