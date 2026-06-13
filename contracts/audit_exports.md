# Module Contract: `audit_exports`

**Version:** 0.2.0

---

### `audit_exports`
Scheduled and on-demand export of audit and compliance records.

**Functions**
```
createExportJob(filters, format, requested_by) → ExportJob
getExportJob(job_id) → ExportJob
listExportJobs(input, options?) → PaginatedResult<ExportJob>
cancelExportJob(job_id) → ExportJob
downloadExport(job_id) → SignedUrl
```

**Types**
```
ExportJob { id, status, filters, format, requested_by, created_at, completed_at?, expires_at?, error_message? }
ExportFormat = json | csv | parquet | ndjson
ExportStatus = queued | running | completed | failed | cancelled | expired
```

**Invariants**
- Exports must preserve the source record ordering defined by the filter/result set.
- Completed exports must expire according to retention policy.
- An export job must not mutate source data.

**Providers:** Axiom, Datadog exports, custom compliance export services, warehouse unload jobs

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Export job state (status transitions) must be immediately consistent to prevent double-execution or lost cancellations

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for export job lifecycle events.
* **Details:** Duplicate job creation events must be idempotent on filter fingerprint.

### Worker Scaling
* **Policy:** Export execution, compression, and upload must scale independently from job creation and status queries.

### Multi-Region Behavior
* **Mode:** Exports read from the region holding the source data; output artifacts are stored in the requester's region.
* **Details:** Cross-region export requests must be routed to the source data region.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Required Functions:**
  - `createExportJob(filters, format, requested_by, idempotency_key?)`
  - `cancelExportJob(job_id, idempotency_key?)`

### Backpressure
* If export generation capacity is saturated, new jobs must be queued and given a `queued` status rather than rejected. Maximum queue depth must be documented by the adapter.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).
* Domain errors: `EXPORT_NOT_FOUND`, `EXPORT_NOT_READY`, `EXPORT_CANCELLED`, `EXPORT_EXPIRED`, `FORMAT_UNSUPPORTED`, `EXPORT_TOO_LARGE`, `EXPORT_FAILED`, `EXPORT_ALREADY_RUNNING`.

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createExportJob    → audit_exports.job.created     { job_id, format, requested_by }
cancelExportJob    → audit_exports.job.cancelled   { job_id }
job completion     → audit_exports.job.completed   { job_id, row_count, size_bytes }
job failure        → audit_exports.job.failed      { job_id, error_message }
```

### Temporal Constraints
```
Export job:
    default_timeout:    60 minutes
    on_exceed:          status → failed; partial output discarded

    retention:
        default:        7 days after completion
        on_expiry:      eligible for deletion; emit audit_exports.job.expired

    cancellation_window:
        default:        until job transitions to running
        on_exceed:      EXCEPTION_CANCELLED if too late; may still cancel via operator
```

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE export_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filters       JSONB NOT NULL,
  format        TEXT NOT NULL CHECK (format IN ('json', 'csv', 'parquet', 'ndjson')),
  status        TEXT NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled', 'expired')),
  requested_by  UUID NOT NULL,
  row_count     BIGINT,
  size_bytes    BIGINT,
  artifact_ref  TEXT,
  error_message TEXT,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ
);

CREATE INDEX idx_export_jobs_status ON export_jobs(status, created_at);
CREATE INDEX idx_export_jobs_requestor ON export_jobs(requested_by, created_at DESC);

CREATE TABLE export_job_audit (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID NOT NULL REFERENCES export_jobs(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_export_job_audit_job ON export_job_audit(job_id, created_at DESC);
```

### Storage Model
* **Model:** Durable export job store with object-storage-backed artifacts.
* **Details:** Job metadata uses PostgreSQL; completed export files live in blob storage (S3, GCS) with signed URL access via `downloadExport`.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `audit_exports.<function>`.
* **Telemetry Metrics:**
```
blueprint_audit_exports_operation_total             counter { function, result }
blueprint_audit_exports_operation_duration_ms       histogram { function }
blueprint_audit_exports_errors_total                counter { function, error_code }
blueprint_audit_exports_jobs_total                   counter { format, status }
blueprint_audit_exports_exported_bytes_total         counter { format }
blueprint_audit_exports_job_duration_ms              histogram { format, row_count_bucket }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** audit_log, storage, jobs
* **Emits To:** events
* **Recommends:** queues, users, notifications

### Breaking Change Policy
- Adding a new export format is additive and backward-compatible.
- Removing or renaming an existing export format requires a MAJOR version bump.
- Changing the default retention period requires a MINOR version bump.
- Adding new required fields to `createExportJob` input requires a MAJOR version bump.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Export fails mid-stream | Source query timeout or storage backend unavailable | Retry with exponential backoff; dead-letter after 3 attempts |
| Export too large | Filter matches excessive records | Reject with EXPORT_TOO_LARGE; recommend narrowing filters |
| Format conversion failure | Unsupported data type in source | Fail with descriptive error; log source schema details |
| Artifact corruption | Storage backend silent data corruption | Store checksum of artifact; verify on download |
