# Module Contract: `storage`

---

### `storage`
File and object storage.

**Functions**
```
uploadFile(bucket, key, content, options?) → FileObject
downloadFile(bucket, key) → FileStream
deleteFile(bucket, key) → void
getSignedUrl(bucket, key, expires_in) → SignedUrl
getSignedUploadUrl(bucket, key, options?) → SignedUrl
listFiles(bucket, prefix?, options?) → PaginatedResult<FileObject>
moveFile(source_bucket, source_key, dest_bucket, dest_key) → FileObject
copyFile(source_bucket, source_key, dest_bucket, dest_key) → FileObject
getMetadata(bucket, key) → FileMetadata
```

**Types**
```
FileObject { key, bucket, size, content_type, url, created_at, metadata? }
FileMetadata { size, content_type, last_modified, etag, custom }
SignedUrl { url, expires_at, method: GET | PUT }
```

**Invariants**
- Signed upload URLs must enforce `content_type` and `max_size` constraints when provided
- `deleteFile` must be idempotent — deleting a non-existent key must not throw

**Providers:** AWS S3, Cloudflare R2, Supabase Storage, MinIO, local disk

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
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
* None explicitly defined.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `storage.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none — wraps external provider)
* **Emits To:** events
* **Recommends:** audit_log
