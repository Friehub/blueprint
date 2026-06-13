# Module: data_import

**Version:** 0.2.0
**Part:** VI -- Platform Operations

## Purpose

Defines the interface for ingesting bulk structured data from external sources into the platform. A data import is an asynchronous, multi-phase operation: a file is uploaded, parsed, validated against a schema, and committed to the target domain module. Each phase produces structured feedback so the caller can observe progress, inspect errors row by row, and decide whether to commit, correct, or abort. This module owns the import lifecycle. It does not own the target domain data -- it calls the target domain's write operations as the commit mechanism.

---

## State Machine

```
UPLOADING → UPLOADED → PARSING → PARSED → VALIDATING → VALIDATED → COMMITTING → COMMITTED
                                         → INVALID     (hard schema failures; user must fix)
                                PARSING → FAILED       (file corrupt / unreadable)
VALIDATED → ABORTED             (user chooses not to commit)
COMMITTING → PARTIALLY_COMMITTED (some rows failed; module reports which)
COMMITTING → FAILED             (total commit failure; rolled back)
```

Transitions:
- `UPLOADING → UPLOADED`: file transfer complete
- `UPLOADED → PARSING`: worker picks up the job
- `PARSING → PARSED`: file parsed into row objects; row count known
- `PARSED → VALIDATING`: schema and business rule validation begins
- `VALIDATING → VALIDATED`: all rows pass or errors are within `maxErrorRate`
- `VALIDATING → INVALID`: error rate exceeds `maxErrorRate`; user must correct source file
- `VALIDATED → COMMITTING`: `commitImport` called
- `VALIDATED → ABORTED`: `abortImport` called before commit
- `COMMITTING → COMMITTED`: all rows written to target domain
- `COMMITTING → PARTIALLY_COMMITTED`: some rows failed at the domain write layer
- `COMMITTING → FAILED`: catastrophic failure; all writes rolled back

---

## Functions

### `createImport(input: CreateImportInput) → ImportJob`
Registers a new import job and returns a presigned upload URL. The caller uploads the file to this URL directly (bypassing the API server for performance).

### `confirmUpload(importId: ImportJobId) → ImportJob`
Signals that the file upload is complete. Triggers the parse phase.

### `getImport(importId: ImportJobId) → ImportJob`
Returns the full import job state including phase progress, row counts, and error summary.

### `listImports(input: ListImportsInput) → PaginatedList<ImportJob>`
Returns import jobs filtered by target module, status, or date range.

### `getImportErrors(input: GetImportErrorsInput) → PaginatedList<ImportRowError>`
Returns row-level validation or commit errors, paginated. Available from `VALIDATING` phase onward.

### `commitImport(importId: ImportJobId) → ImportJob`
Initiates the commit phase. Only valid when status is `VALIDATED`. Triggers async writes to the target domain module.

### `abortImport(importId: ImportJobId) → void`
Cancels an import that is in `PARSED` or `VALIDATED` state. Cannot abort after `COMMITTING` begins.

### `downloadErrorReport(importId: ImportJobId) → SignedUrl`
Returns a signed URL to download a CSV/XLSX file containing only the errored rows with error annotations. Available when status is `INVALID`, `VALIDATED` (with partial errors), or `PARTIALLY_COMMITTED`.

### `retryFailedRows(importId: ImportJobId) → ImportJob`
Re-attempts the commit for rows that failed during `PARTIALLY_COMMITTED`. Only valid when status is `PARTIALLY_COMMITTED`.

---

## Types

```typescript
type ImportJobId = string;
type ImportRowErrorId = string;

type ImportStatus =
  | "UPLOADING"
  | "UPLOADED"
  | "PARSING"
  | "PARSED"
  | "VALIDATING"
  | "VALIDATED"
  | "INVALID"
  | "COMMITTING"
  | "COMMITTED"
  | "PARTIALLY_COMMITTED"
  | "ABORTED"
  | "FAILED";

type ImportFormat = "CSV" | "TSV" | "XLSX" | "JSON" | "NDJSON";

type ColumnMapping = {
  sourceColumn: string;            // Column header in the uploaded file
  targetField: string;             // Field name in the target domain schema
  required: boolean;
  transform?: string;              // Named transform to apply (e.g. "trim", "lowercase", "parse_date")
};

type ImportSchemaDefinition = {
  targetModule: string;            // e.g. "users", "catalog", "crm_leads"
  targetOperation: string;         // e.g. "createUser", "upsertProduct", "createLead"
  columns: ColumnMapping[];
  maxErrorRate: number;            // 0.0 -- 1.0; fraction of rows allowed to have errors before INVALID
  onDuplicate: "SKIP" | "UPDATE" | "ERROR";
};

type ImportJob = {
  importId: ImportJobId;
  targetModule: string;
  targetOperation: string;
  format: ImportFormat;
  status: ImportStatus;
  uploadUrl?: string;              // Presigned URL; only present in UPLOADING state
  fileName?: string;
  fileSizeBytes?: number;
  totalRows?: number;
  parsedRows?: number;
  validRows?: number;
  errorRows?: number;
  committedRows?: number;
  failedRows?: number;
  uploadedAt?: Timestamp;
  parsingStartedAt?: Timestamp;
  validationStartedAt?: Timestamp;
  commitStartedAt?: Timestamp;
  completedAt?: Timestamp;
  errorReportUrl?: string;
  requestedBy: UserId;
  createdAt: Timestamp;
};

type ImportRowError = {
  errorId: ImportRowErrorId;
  importId: ImportJobId;
  rowIndex: number;
  phase: "PARSING" | "VALIDATION" | "COMMIT";
  field?: string;
  errorCode: string;
  errorMessage: string;
  rawValue?: string;
};

type CreateImportInput = {
  targetModule: string;
  targetOperation: string;
  format: ImportFormat;
  schema: ImportSchemaDefinition;
  fileName: string;
  fileSizeBytes: number;
  requestedBy: UserId;
};

type ListImportsInput = {
  targetModule?: string;
  status?: ImportStatus;
  requestedBy?: UserId;
  fromDate?: Timestamp;
  toDate?: Timestamp;
  pagination: PaginationInput;
};

type GetImportErrorsInput = {
  importId: ImportJobId;
  phase?: "PARSING" | "VALIDATION" | "COMMIT";
  pagination: PaginationInput;
};
```

---

## Invariants

1. `commitImport` is only valid when status is `VALIDATED`; calling it in any other state returns `IMPORT_NOT_READY`.
2. The `uploadUrl` must be presigned and expire within 1 hour of `createImport`; uploads after expiry must be rejected by the storage layer.
3. `maxErrorRate` is evaluated after the full validation pass; a file with 5% errors and `maxErrorRate = 0.1` transitions to `VALIDATED` (with errors noted), not `INVALID`.
4. The commit phase writes rows to the target domain module in idempotent batches; row-level failures are captured as `ImportRowError` records and must not abort the entire commit.
5. `abortImport` after `COMMITTING` has started must return `IMPORT_NOT_ABORTABLE`; partial commits must be resolved via `retryFailedRows` or manual correction.
6. `downloadErrorReport` must only be available for statuses that have error rows; calling it on a `COMMITTED` (zero errors) import returns `NO_ERRORS_TO_REPORT`.
7. All uploaded files must be stored in the `storage` module and deleted 7 days after the import reaches a terminal state.
8. Row indices in `ImportRowError` are 1-based and correspond to the row number in the source file including the header row.

---

## Events Emitted

- `import.created`
- `import.uploaded`
- `import.parsing.started`
- `import.parsing.completed` -- includes `totalRows`
- `import.validation.started`
- `import.validation.completed` -- includes `validRows`, `errorRows`
- `import.invalid` -- error rate exceeded threshold
- `import.committed` -- includes `committedRows`
- `import.partially_committed` -- includes `committedRows`, `failedRows`
- `import.failed`
- `import.aborted`

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Import job state must be immediately consistent; phase transitions are ACID

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for phase job delivery.
* **Details:** Parse and commit workers must tolerate duplicate execution and use durable phase markers.

### Worker Scaling
* **Policy:** Parse, validation, and commit workers must be independently scalable because their resource profiles differ.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether import processing is single-region or active/passive.
* **Details:** Duplicate phase pickup across regions must be deduplicated.

### Idempotency Requirements
* **Standard:** Each import job is a unique entity; idempotency at the row level is enforced by the `onDuplicate` policy passed to the target domain operation.

### Backpressure
* If async phase capacity is saturated, new phase work must be deferred or rejected predictably rather than enqueued without bound.

### Error Taxonomy
### Module-Specific Errors
```
createImport:
    unsupported_format:        File format is not supported | use CSV, TSV, XLSX, JSON, or NDJSON
    file_too_large:            File exceeds maximum allowed size | reduce file size or split into batches
    schema_mismatch:           Provided schema does not match the target module's expected schema | fix column mappings

  confirmUpload:
    upload_url_expired:        Presigned upload URL has expired | create a new import job
    import_not_found:          No import job with that ID | verify importId

  commitImport:
    import_not_ready:          Import is not in VALIDATED state | wait for validation to complete
    import_not_abortable:      Import is already in COMMITTING state | wait for completion

  downloadErrorReport:
    no_errors_to_report:       Import completed with zero errors | no report available
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createImport         → import.created                { import_id, target_module, format }
  confirmUpload       → import.uploaded                { import_id }
  ─                   → import.parsing.started         { import_id }
  ─                   → import.parsing.completed       { import_id, total_rows }
  ─                   → import.validation.started      { import_id }
  ─                   → import.validation.completed    { import_id, valid_rows, error_rows }
  ─                   → import.invalid                 { import_id, error_rate }
  commitImport        → import.committed               { import_id, committed_rows }
  ─                   → import.partially_committed     { import_id, committed_rows, failed_rows }
  ─                   → import.failed                  { import_id, reason }
  abortImport         → import.aborted                 { import_id }
```

### Temporal Constraints
```
Upload URL expiry:
    duration:       1 hour from createImport
    on_expiry:      caller must create a new import job

  Retry policy for phase workers:
    max_attempts:   3
    backoff:        exponential, 30s initial

  File retention after terminal state:
    duration:       7 days
    on_expiry:      delete from object storage
```

### Storage Model
* **Model:** Durable import job state with object-storage-backed file uploads.
* **Details:** Import job records and row error history are persisted in a strongly consistent store. Uploaded files live in object storage.

### Database Schema

#### PostgreSQL
```sql
CREATE TYPE import_status AS ENUM (
  'UPLOADING', 'UPLOADED', 'PARSING', 'PARSED',
  'VALIDATING', 'VALIDATED', 'INVALID',
  'COMMITTING', 'COMMITTED', 'PARTIALLY_COMMITTED',
  'ABORTED', 'FAILED'
);

CREATE TABLE data_import_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_module     TEXT NOT NULL,
  target_operation  TEXT NOT NULL,
  format            TEXT NOT NULL CHECK (format IN ('CSV', 'TSV', 'XLSX', 'JSON', 'NDJSON')),
  status            import_status NOT NULL DEFAULT 'UPLOADING',
  schema_def        JSONB NOT NULL,
  file_name         TEXT,
  file_size_bytes   BIGINT,
  total_rows        INT,
  valid_rows        INT,
  error_rows        INT,
  committed_rows    INT,
  failed_rows       INT,
  upload_url        TEXT,
  error_report_url  TEXT,
  requested_by      UUID NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX idx_import_status ON data_import_jobs(status) WHERE status NOT IN ('COMMITTED', 'ABORTED', 'FAILED');
CREATE INDEX idx_import_target ON data_import_jobs(target_module, created_at DESC);

CREATE TABLE data_import_errors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id       UUID NOT NULL REFERENCES data_import_jobs(id) ON DELETE CASCADE,
  row_index       INT NOT NULL,
  phase           TEXT NOT NULL CHECK (phase IN ('PARSING', 'VALIDATION', 'COMMIT')),
  field           TEXT,
  error_code      TEXT NOT NULL,
  error_message   TEXT NOT NULL,
  raw_value       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_errors_job ON data_import_errors(import_id, row_index);
```

### Observability
* **Tracing Spans:** Each import job is a trace root. Phase transitions are spans annotated with row counts and error rates. The `commitImport` span must link to child spans for each batch write to the target domain.
* **Telemetry Metrics:**
```
blueprint_data_import_jobs_total                 { target_module, status }
  blueprint_data_import_rows_processed_total      { phase, result }
  blueprint_data_import_phase_duration_ms          histogram { phase }
  blueprint_data_import_file_size_bytes             histogram { format }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** storage (file upload and retention), queues (async phase execution), jobs (phase timeout enforcement), reporting (error report generation), auth (upload URL signing)
* **Emits To:** events
* **Recommends:** notifications, audit_log

### Providers
Custom implementation backed by S3/GCS presigned URLs, AWS Glue (ETL), Flatfile.com, Airbyte (for data pipeline imports), Papa Parse (client-side parse layer reference).
