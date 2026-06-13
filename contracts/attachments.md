# Module Contract: `attachments`

**Version:** 0.2.0

---

### `attachments`
File attachment lifecycle, linking, preview metadata, and retention management across domain entities.

**Functions**
```
createAttachment(owner_id, file_ref, metadata?) → Attachment
getAttachment(attachment_id) → Attachment
listAttachments(input, options?) → PaginatedResult<Attachment>
linkAttachment(attachment_id, entity_ref) → AttachmentLink
unlinkAttachment(attachment_id, entity_ref) → void
deleteAttachment(attachment_id) → void
createPreview(attachment_id, options?) → AttachmentPreview
getPreview(attachment_id) → AttachmentPreview?
```

**Types**
```
Attachment { id, owner_id, file_ref, mime_type, size_bytes, checksum?, status, created_at, updated_at }
AttachmentLink { id, attachment_id, entity_type, entity_id, created_at }
AttachmentPreview { attachment_id, url?, status, expires_at? }
AttachmentStatus = pending | linked | quarantined | deleted | expired
```

**Invariants**
- Attachment links must be idempotent per `(attachment_id, entity_ref)`.
- Quarantined attachments must not be linkable.
- Deleted attachments must preserve an audit trail even if content is removed.

**Providers:** storage-backed attachment services, S3+metadata stores, Cloudinary assets, enterprise document attachments

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Attachment metadata, links, and status transitions must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for attachment lifecycle events.
* **Details:** Duplicate link events must be idempotent per (attachment_id, entity_ref).

### Worker Scaling
* **Policy:** Preview generation, virus scanning, and content upload are background workloads and must scale independently from metadata operations.

### Multi-Region Behavior
* **Mode:** Attachment content is stored in the region closest to the owning entity; metadata is global.
* **Details:** Cross-region attachment access must stream from the source region or use a CDN with signed URLs.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Required Functions:**
  - `createAttachment(owner_id, file_ref, metadata?, idempotency_key?)`
  - `linkAttachment(attachment_id, entity_ref, idempotency_key?)`
  - `deleteAttachment(attachment_id, idempotency_key?)`

### Backpressure
* If upload or preview generation is saturated, the module must reject new uploads with `429 Too Many Requests` rather than queueing beyond capacity.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).
* Domain errors: `ATTACHMENT_NOT_FOUND`, `ATTACHMENT_QUARANTINED`, `ATTACHMENT_LINK_EXISTS`, `ATTACHMENT_TOO_LARGE`, `ATTACHMENT_INVALID`, `ATTACHMENT_EXPIRED`, `ATTACHMENT_UPLOAD_FAILED`, `ATTACHMENT_PREVIEW_FAILED`.

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createAttachment    → attachments.attachment.created        { attachment_id, owner_id, mime_type, size_bytes }
linkAttachment      → attachments.attachment.linked          { attachment_id, entity_type, entity_id }
unlinkAttachment    → attachments.attachment.unlinked        { attachment_id, entity_type, entity_id }
deleteAttachment    → attachments.attachment.deleted         { attachment_id }
createPreview       → attachments.preview.available          { attachment_id, status }
```

### Temporal Constraints
```
Attachment:
    retention_days:     configurable per tenant (default 365)
    on_expiry:          status → expired; content eligible for deletion
                        emit attachments.attachment.expired

    preview:
        generation_timeout: 30 seconds
        on_exceed:          status → failed; retry on demand

    quarantine:
        auto_clean_days:    30
        on_expiry:          delete permanently; keep audit trail

Signed URL:
    default_ttl:        3600 seconds (1 hour)
    on_expiry:          regenerate or return ATTACHMENT_EXPIRED
```

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL,
  file_ref    TEXT NOT NULL,
  mime_type   TEXT NOT NULL,
  size_bytes  BIGINT NOT NULL CHECK (size_bytes > 0),
  checksum    TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'linked', 'quarantined', 'deleted', 'expired')),
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attachments_owner ON attachments(owner_id);
CREATE INDEX idx_attachments_status ON attachments(status);

CREATE TABLE attachment_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id UUID NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attachment_id, entity_type, entity_id)
);

CREATE INDEX idx_attachment_links_entity ON attachment_links(entity_type, entity_id);

CREATE TABLE attachment_previews (
  attachment_id UUID PRIMARY KEY REFERENCES attachments(id) ON DELETE CASCADE,
  url           TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'available', 'failed', 'expired')),
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE attachment_audit (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id UUID NOT NULL,
  action        TEXT NOT NULL,
  actor_id      UUID,
  details       JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attachment_audit_att ON attachment_audit(attachment_id, created_at DESC);
```

### Storage Model
* **Model:** Durable attachment metadata store with object storage backing for content.
* **Details:** Content lives in blob storage (S3, GCS, Azure Blob); metadata uses PostgreSQL with strong consistency. Quarantined and deleted entries retain audit metadata even after content removal.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `attachments.<function>`.
* **Telemetry Metrics:**
```
blueprint_attachments_operation_total            counter { function, result }
blueprint_attachments_operation_duration_ms      histogram { function }
blueprint_attachments_errors_total               counter { function, error_code }
blueprint_attachments_uploaded_bytes_total        counter { mime_type }
blueprint_attachments_preview_generation_duration_ms histogram { status }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** storage, audit_log
* **Emits To:** events
* **Recommends:** search, notifications, virus_scanner

### Breaking Change Policy
- Adding a new attachment status is additive and backward-compatible.
- Removing or renaming an existing status value requires a MAJOR version bump.
- Changing the checksum algorithm requires a MAJOR version bump.
- Adding new required fields to `createAttachment` input requires a MAJOR version bump.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Upload fails mid-stream | Network error or storage backend timeout | Store partial metadata; retry with idempotency key; abort after 3 attempts |
| Virus detected after linking | Async scan catches threat post-link | Transition to quarantined; notify owner; block downstream access |
| Preview generation timeout | Unsupported file or oversized document | Set preview status to failed; surface preview_unavailable in getPreview |
| Checksum mismatch | Corrupted upload | Reject with ATTACHMENT_INVALID; client must re-upload |
| Content deleted but links remain | Cascade failure on entity delete | Orphan detection job runs daily; emit warning for stale links |
