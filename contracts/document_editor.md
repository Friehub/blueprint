# Module Contract: `document_editor`

---

### `document_editor`
Collaborative workspace document creation, versioned revision history, and concurrent edit locking.

**Functions**
```
createDocument(title, workspace_id) → Document
saveRevision(document_id, content, author_id) → Revision
getRevisionHistory(document_id, options?) → PaginatedResult<Revision>
restoreRevision(revision_id) → Document
acquireEditLock(document_id, user_id) → EditLock
```

**Types**
```
Document { id, title, workspace_id, status, created_at, updated_at }
Revision { id, document_id, content, author_id, version, created_at }
EditLock { document_id, user_id, acquired_at, expires_at }

DocumentStatus = active | archived
```

**Invariants**
- **Strict Version Monotonicity**: Revision versions must increment sequentially (+1) per document revision. Gaps or duplicates are not permitted.
- **Mutual Exclusion Edit Lock**: While a valid `EditLock` is active on a document, only the lock holder can successfully execute `saveRevision`. Attempting to save without the lock must be rejected.
- **Immutability of Revisions**: Revisions are read-only historical states. Restoring a revision must create a new monotonic revision containing the restored content, rather than deleting intermediate versions.

**Providers:** custom editor databases, Yjs/Automerge collaboration stores, MongoDB, relational DBs with lock registries

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong` (for `acquireEditLock` operations) and `read_your_writes` (for `saveRevision` and document retrieval).
* **Details:** Locks must be immediately consistent to avoid race conditions during concurrent editing.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for revision persistence and event emission.
* **Details:** Duplicate revision submission must not create duplicate visible versions.

### Worker Scaling
* **Policy:** Revision write paths and lock-check paths must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether editing is single-region or active/passive.
* **Details:** Lock ownership must not diverge across regions.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Required Functions:**
  - `createDocument(title, workspace_id, idempotency_key?)`

### Backpressure
* If lock contention or revision write pressure is high, the module must reject or defer predictably rather than corrupting state.

### Error Taxonomy
### Module-Specific Errors
```
saveRevision:
    lock_held_by_other:        The document edit lock is currently held by another user | return 423 Locked
    document_archived:         The document has been archived and cannot be edited | reject
    revision_conflict:         Save version does not match current head (concurrent editing conflict) | reject

acquireEditLock:
    already_locked:            Lock already held by another active user | return 423 Locked
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createDocument    → document.created        { document_id, workspace_id }
saveRevision      → document.revision.saved  { document_id, version, author_id }
restoreRevision   → document.restored        { document_id, restored_revision_id, new_version }
```

### Temporal Constraints
```
EditLock:
    max_duration:   5 minutes (configurable)
    on_expiry:      evict lock silently, making lock available for acquisition
```

### Storage Model
* **Model:** Durable revision store with lock registry.
* **Details:** Revisions must be persisted durably; lock state may be stored in a fast ephemeral store but must be backed by expiry enforcement.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `document_editor.<function>`.
* **Telemetry Metrics:**
```
gensense_documents_total                    gauge { status }
gensense_document_revisions_total           counter { document_id }
gensense_document_lock_contention_total     counter { document_id }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** workspaces, users
* **Emits To:** events
* **Recommends:** storage (for large document content blobs), audit_log, caching (for low-latency lock checking)
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `created_at DESC` on `getRevisionHistory`.
