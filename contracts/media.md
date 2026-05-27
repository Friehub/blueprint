# Module Contract: `media`

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
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
```
Asset retention:
    retention:         configurable per deployment or asset class
    on_expiry:         delete or archive according to policy
```

### Storage Model
* **Model:** Durable media asset store with processing queue.
* **Details:** Original assets and derived variants must remain queryable until retention expiry.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `media.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none — infrastructure primitive / wraps external provider)
* **Emits To:** events
* **Recommends:** (none)
