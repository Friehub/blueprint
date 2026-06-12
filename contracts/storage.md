# Module Contract: `storage`

**Version:** 0.1.0

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
- `deleteFile` must be idempotent -- deleting a non-existent key must not throw
- Any URL submitted for signed upload, copy, or move must be validated against a configured allowlist of permitted domains or CIDR ranges before the URL is used
- Any URL that resolves to a private IP address range (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8) or a cloud metadata endpoint (169.254.169.254) must be rejected unconditionally
- Redirect following must be disabled or constrained to the originally allowed domain

**Providers:** AWS S3, Cloudflare R2, Supabase Storage, MinIO, local disk

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)` for metadata index; `eventual` for object read-after-write on some backends
* **Details:** Adapter must document the provider's read-after-write consistency guarantee

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for metadata and object lifecycle events.
* **Details:** Duplicate uploads or retries must not create duplicate durable objects when the same key is used.

### Worker Scaling
* **Policy:** Upload/download and metadata workloads must be independently scalable where the backend uses workers.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether storage is single-region, multi-region replicated, or active/passive.
* **Details:** Cross-region replication lag must be documented by the adapter.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Required Functions:** `uploadFile`, `deleteFile`, `moveFile`, `copyFile`

### Backpressure
* If storage throughput is saturated, uploads and copy/move operations must fail or defer predictably rather than accepting unbounded work. Download operations should not be throttled for reads.

### Error Taxonomy
### Module-Specific Errors
```
uploadFile:
    bucket_not_found:          The specified bucket does not exist | create bucket first
    object_too_large:          File exceeds bucket or provider max size | split or use multipart upload
    content_type_mismatch:     Uploaded content type does not match signed URL constraint | regenerate URL

  downloadFile:
    object_not_found:          The specified key does not exist in the bucket | check key or path

  deleteFile:
    delete_conflict:           Object is locked or has retention policy | remove policy first
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
uploadFile   → storage.object.created    { bucket, key, size, content_type }
deleteFile   → storage.object.deleted    { bucket, key }
moveFile     → storage.object.moved      { source_bucket, source_key, dest_bucket, dest_key }
copyFile     → storage.object.copied     { source_bucket, source_key, dest_bucket, dest_key }
```

### Temporal Constraints
```
Object retention:
    retention:         configurable per bucket or object class
    on_expiry:         delete or transition according to policy

  Signed URL expiry:
    max_duration:      configurable, default 1 hour for upload, 7 days for download
    on_expiry:         URL returns 403 Forbidden; caller must request new URL
```

### Storage Model
* **Model:** Object storage with optional metadata index.
* **Details:** Provider must document durability, replication, and retention semantics.

```sql
CREATE TABLE storage_metadata (
    id              UUID PRIMARY KEY,
    bucket          VARCHAR(255) NOT NULL,
    key             VARCHAR(1024) NOT NULL,
    size            BIGINT NOT NULL,
    content_type    VARCHAR(255),
    etag            VARCHAR(255),
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_modified   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(bucket, key)
);

CREATE INDEX idx_storage_metadata_bucket ON storage_metadata(bucket);
CREATE INDEX idx_storage_metadata_prefix ON storage_metadata(bucket, key text_pattern_ops);
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `storage.<function>`.
* **Telemetry Metrics:**
```
gensense_storage_operation_total            counter { function, result: success|failure }
gensense_storage_operation_duration_ms      histogram { function, p50, p95, p99 }
gensense_storage_errors_total               counter { function, error_code }
gensense_storage_objects_total              gauge { bucket }
gensense_storage_bytes_total                gauge { bucket }
gensense_storage_transfer_bytes             counter { bucket, operation: upload|download }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Storage backend unavailable | Return ProviderError, do not retry indefinitely |
| Signed URL generation fails | Return error; caller should retry |
| Object not found on download | Return object_not_found, do not retry |
| Multipart upload part failure | Abort upload, clean up partial parts; caller must retry |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise

### Module Dependencies
* **Depends On:** (none -- wraps external provider)
* **Emits To:** events
* **Recommends:** audit_log
