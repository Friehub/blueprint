# Module Contract: `file_upload`

**Version:** 0.2.0

---

### `file_upload`
File upload pipeline with chunked uploads, virus scanning, CDN invalidation, and access control.

**Functions**
```
initiateUpload(file_info, options?) → UploadSession
uploadChunk(session_id, chunk_index, data) → ChunkResult
completeUpload(session_id) → FileAsset
cancelUpload(session_id) → void
getUploadSession(session_id) → UploadSession
getSignedUrl(file_id, operation, expires_in) → SignedUrl
requestVirusScan(file_id) → ScanResult
invalidateCdn(file_id, paths?) → void
deleteFile(file_id, options?) → void
```

**Types**
```
UploadSession { id, status: initiated|uploading|completed|cancelled, file_name, mime_type, total_size, chunk_count, completed_chunks, expires_at }
ChunkResult { session_id, chunk_index, received, next_expected }
FileAsset { id, file_name, mime_type, size, storage_path, public_url, cdn_url?, checksum, virus_status: pending|clean|infected|error, uploaded_at }
SignedUrl { url, method, headers?, expires_at }
ScanResult { file_id, status, scanner, threats: Threat[], scanned_at }
Threat { name, type, severity, action: quarantined|deleted|allowed }
UploadOptions { max_size_bytes, allowed_types[], compress, generate_thumbnails, public: bool }
AccessPolicy { read_roles[], write_roles[], public_read: bool, cdn_auth: bool }
```

**Invariants**
- `initiateUpload` must validate `file_info` against max size and allowed MIME types before creating the session -- an invalid file must be rejected before any chunks are uploaded
- `completeUpload` must verify that all expected chunks have been received and that the assembled file checksum matches -- a mismatched checksum must fail the upload
- An upload session that has not received any chunks for more than the session timeout must be automatically cancelled and cleaned up
- `requestVirusScan` must be called before the file URL is made publicly accessible -- serving an unscanned file is a security violation
- An infected file must be quarantined and must not be accessible via its public URL
- `deleteFile` must invalidate the CDN cache for the file before removing it from storage -- serving a deleted file from cache is a data leak

**Providers:** AWS S3 + presigned URLs, GCP Cloud Storage + signed URLs, Azure Blob Storage + SAS, Uploadcare, Transloadit

**Dependencies:** media

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Upload session state and file metadata must be immediately consistent.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for file lifecycle events.
* **Details:** Duplicate chunk uploads must be idempotent (same chunk_index overwrites safely).

### Worker Scaling
* **Policy:** Chunk upload handling, virus scanning, and CDN invalidation must be independently scalable.

### Multi-Region Behavior
* **Mode:** Upload destination should be the region closest to the user; files are replicated asynchronously.
* **Details:** A file uploaded in one region must be accessible from all regions within the replication SLA.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* When concurrent upload sessions exceed the configured limit, new `initiateUpload` calls must be rejected with `upload_capacity_exceeded`.
* Chunk ingestion rate must be throttled per session to prevent resource exhaustion.

### Event Emission
```
initiateUpload     -> file_upload.session.created    { session_id, file_name, size }
  completeUpload     -> file_upload.file.uploaded     { file_id, file_name, size }
  requestVirusScan   -> file_upload.scan.requested    { file_id }
                   -> file_upload.scan.completed     { file_id, status, threats }
  deleteFile         -> file_upload.file.deleted      { file_id, reason }
```

### Temporal Constraints
```
Upload session timeout:
    default:        30 minutes from last chunk received
    on_expiry:      auto-cancel session; clean up partial chunks

  Signed URL expiry:
    default:        1 hour
    on_expiry:      URL returns 403 Forbidden

  CDN invalidation propagation:
    max_delay:      5 minutes
    on_expiry:      retry invalidation up to 3 times
```

### Storage Model
* **Model:** Durable upload session and file asset store with virus scan metadata.
* **Details:** Upload sessions are ephemeral (TTL-driven). File assets are durable. Scan results are immutable.

### Database Schema

#### PostgreSQL
```sql
CREATE TYPE upload_session_status AS ENUM ('initiated', 'uploading', 'completed', 'cancelled');
CREATE TYPE virus_status AS ENUM ('pending', 'clean', 'infected', 'error');

CREATE TABLE upload_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name         TEXT NOT NULL,
  mime_type         TEXT NOT NULL,
  total_size        BIGINT NOT NULL,
  chunk_count       INT NOT NULL,
  completed_chunks  INT NOT NULL DEFAULT 0,
  status            upload_session_status NOT NULL DEFAULT 'initiated',
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_upload_sessions_expires ON upload_sessions(expires_at)
  WHERE status IN ('initiated', 'uploading');

CREATE TABLE file_assets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name         TEXT NOT NULL,
  mime_type         TEXT NOT NULL,
  size              BIGINT NOT NULL,
  storage_path      TEXT NOT NULL,
  checksum          TEXT NOT NULL,
  virus_status      virus_status NOT NULL DEFAULT 'pending',
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE virus_scan_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id           UUID NOT NULL REFERENCES file_assets(id),
  status            virus_status NOT NULL,
  scanner           TEXT NOT NULL,
  threats           JSONB,
  scanned_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scan_results_file ON virus_scan_results(file_id);

CREATE TABLE cdn_invalidations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id           UUID NOT NULL REFERENCES file_assets(id),
  paths             JSONB,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  attempts          INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Failure Modes & Breaking Change Policy

| Failure Mode | Detection | Mitigation |
|---|---|---|
| Upload session timeout | Session expires with no chunks received | Auto-cancel; clean up partial chunks |
| Checksum mismatch on completion | `completeUpload` checksum validation fails | Reject; client must re-upload corrupted chunks |
| Virus scan detects infection | `ScanResult.status` = infected | Quarantine file; revoke public URL; notify uploader |
| CDN invalidation fails after retries | `cdn_invalidations.status` = failed | Retry manually; invalidate via provider UI as fallback |
| Chunk upload exceeds session limit | `upload_capacity_exceeded` | Reject new uploads; scale chunk ingestion workers |

**Breaking Changes:** Changing the chunk size or checksum algorithm is breaking for in-flight upload sessions. MIME type validation changes may break existing allowed types. `SignedUrl` expiry reduction is breaking for clients with long-running operations.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `file_upload.<function>`.
* **Telemetry Metrics:**
```
blueprint_file_upload_sessions_total            { status }
blueprint_file_upload_chunks_received_total     { session_id }
blueprint_file_upload_scan_results_total        { status }
blueprint_file_upload_cdn_invalidation_total    { status }
blueprint_file_upload_throughput_bytes          gauge
blueprint_file_upload_size_distribution         histogram
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** media
* **Emits To:** events
* **Recommends:** storage, content_safety (for scan integration), audit_log
