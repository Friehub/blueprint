# Module Contract: `attachments`

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

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Attachment linking and deletion must be durably recorded before exposure.
- **Idempotency:** `createAttachment`, `linkAttachment`, and `deleteAttachment` must be idempotent on attachment identity.
- **Storage Model:** Durable attachment metadata store with object storage backing for content.
- **Dependencies:** `storage`, `audit_log`, `search` (if attachments are indexed), `notifications`.
- **Errors:** `ATTACHMENT_NOT_FOUND`, `ATTACHMENT_QUARANTINED`, `ATTACHMENT_LINK_EXISTS`, `ATTACHMENT_TOO_LARGE`, `ATTACHMENT_INVALID`, `ATTACHMENT_EXPIRED`.
