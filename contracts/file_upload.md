# Module Contract: `file_upload`

**Version:** 0.1.0

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

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `file_upload.<function>`.

### Module Dependencies
* **Depends On:** media
* **Emits To:** events
* **Recommends:** storage, content_safety (for scan integration), audit_log
