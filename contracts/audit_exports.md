# Module Contract: `audit_exports`

**Version:** 0.1.0

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

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Export selection criteria must be durably recorded before job execution.
- **Idempotency:** `createExportJob` and `cancelExportJob` must be idempotent on job identity or filter fingerprint.
- **Storage Model:** Durable export job store with object-storage-backed artifacts.
- **Dependencies:** `audit_log`, `storage`, `jobs`, `queues`, `users`.
- **Errors:** `EXPORT_NOT_FOUND`, `EXPORT_NOT_READY`, `EXPORT_CANCELLED`, `EXPORT_EXPIRED`, `FORMAT_UNSUPPORTED`, `EXPORT_TOO_LARGE`.
