# Module Contract: `media`

**Version:** 0.1.0

---

### `media`
Image and video processing pipeline.

**Functions**
```
uploadMedia(file, options?) → MediaAsset
processMedia(asset_id, transformations) → ProcessingJob
getMediaAsset(asset_id) → MediaAsset
getVariants(asset_id) → MediaVariant[]
deleteMediaAsset(asset_id) → void
generateThumbnail(asset_id, options?) → MediaVariant
transcodeVideo(asset_id, format, options?) → ProcessingJob
getProcessingJob(job_id) → ProcessingJob
```

**Types**
```
MediaAsset { id, type: image|video|audio|document, url, size, metadata, created_at }
MediaVariant { id, asset_id, transformation, url, size }
ProcessingJob { id, asset_id, status, result_url?, created_at }
Transformation { width?, height?, format?, quality?, crop? }
```

**Invariants**
- Any URL submitted for `uploadMedia`, `processMedia`, or `transcodeVideo` must be validated against a configured allowlist of permitted domains before the URL is used — URLs not on the allowlist must be rejected with `DOMAIN_NOT_ALLOWED`.
- Any URL that resolves to a private IP address range (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8) or a cloud metadata endpoint (169.254.169.254) must be rejected unconditionally — server-side DNS resolution must verify the resolved address is not private.
- Redirect following must be disabled or constrained to the originally allowed domain — following a redirect to a non-allowed domain is a contract violation.
- `uploadMedia` with an `idempotency_key` that matches an existing asset must return the existing `MediaAsset` rather than creating a duplicate — processing must be idempotent by asset identity.
- `deleteMediaAsset` must remove all variants and the original from storage — orphaned variants without a parent asset are a contract violation.
- `transcodeVideo` must validate the output format against the supported codec list before queuing — unsupported format must return `UNSUPPORTED_FORMAT`.

**Providers:** Cloudinary, AWS MediaConvert + S3, Uploadcare, imgix

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Standard transactional consistency

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for processing jobs and asset lifecycle events.
* **Details:** Duplicate processing retries must not create duplicate durable assets.

### Worker Scaling
* **Policy:** Upload, transform, and transcode workloads must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether media processing is single-region or active/passive.
* **Details:** Duplicate cross-region job pickup must be deduplicated by asset/job identity.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If processing capacity is saturated, jobs must be queued or rejected predictably rather than dropping transformations silently.

### Error Taxonomy
### Module-Specific Errors
```
uploadMedia / processMedia / transcodeVideo:
    domain_not_allowed:       Source URL domain not on allowlist | verify URL against allowed domains
    private_ip_resolved:      URL resolved to private IP range | reject source URL
    unsupported_format:       Output format not in supported codec list | use supported format
    processing_failed:        Media processing job failed | check job error details
    asset_too_large:          File exceeds maximum allowed size | reduce file size or use chunked upload

  deleteMediaAsset:
    asset_not_found:          Asset ID does not exist | verify asset_id
    asset_in_use:             Asset referenced by active processing jobs | cancel jobs before deletion
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
uploadMedia        → media.asset.created          { asset_id, type, size }
processMedia       → media.processing.started     { asset_id, transformations }
                   → media.processing.completed   { asset_id, variant_id }
                   OR media.processing.failed     { asset_id, error }
deleteMediaAsset   → media.asset.deleted          { asset_id }
generateThumbnail  → media.thumbnail.generated    { asset_id, variant_id }
transcodeVideo     → media.transcode.started      { asset_id, format }
                   → media.transcode.completed    { asset_id, variant_id }
```

### Temporal Constraints
```
Asset retention:
    retention:         configurable per deployment or asset class
    on_expiry:         delete or archive according to policy

  Processing job timeout:
    default:          30 minutes
    on_expiry:         mark job as failed with processing_failed error

  Thumbnail generation:
    max_duration:     30 seconds
    on_expiry:         return timeout error; retry with lower quality
```

### Storage Model
* **Model:** Durable media asset store with processing queue.

#### PostgreSQL
```sql
CREATE TYPE media_type AS ENUM ('image', 'video', 'audio', 'document');

CREATE TABLE media_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            media_type NOT NULL,
  url             TEXT NOT NULL,
  size            BIGINT NOT NULL CHECK (size > 0),
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_assets_type ON media_assets(type);
CREATE INDEX idx_assets_created ON media_assets(created_at DESC);

CREATE TABLE media_variants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        UUID NOT NULL REFERENCES media_assets(id),
  transformation  JSONB NOT NULL,
  url             TEXT NOT NULL,
  size            BIGINT NOT NULL CHECK (size > 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_variants_asset ON media_variants(asset_id);

CREATE TABLE media_processing_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        UUID NOT NULL REFERENCES media_assets(id),
  status          TEXT NOT NULL DEFAULT 'pending',
  result_url      TEXT,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_jobs_asset ON media_processing_jobs(asset_id);
CREATE INDEX idx_jobs_status ON media_processing_jobs(status) WHERE status IN ('pending', 'running');
```
* **Details:** Original assets and derived variants must remain queryable until retention expiry.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `media.<function>`.
* **Telemetry Metrics:**
```
blueprint_media_operations_total           { function, result }
blueprint_media_operation_duration_ms      histogram { function }
blueprint_media_errors_total               { code }
blueprint_media_assets_total               gauge { type }
blueprint_media_processing_queue_depth     gauge { status }
blueprint_media_storage_usage_bytes        gauge
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return provider_error, do not retry indefinitely |
| Provider rate limited | Respect Retry-After header, apply exponential backoff |
| Partial success in batch | Return partial_success with succeeded[] and failed[] |
| URL SSRF detection | Return private_ip_resolved; log blocked attempt for security audit |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new media type enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise

### Module Dependencies
* **Depends On:** (none -- infrastructure primitive / wraps external provider)
* **Emits To:** events
* **Recommends:** storage, caching, queues (for async processing)
