# Module Contract: `document_editor`

**Version:** 0.1.0

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

### Database Schema

#### PostgreSQL
```sql
CREATE TYPE document_status AS ENUM ('active', 'archived');

CREATE TABLE documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  workspace_id      UUID NOT NULL,
  status            document_status NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_workspace ON documents(workspace_id);

CREATE TABLE document_revisions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id       UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version           INT NOT NULL,
  content           TEXT NOT NULL,
  author_id         UUID NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, version)
);

CREATE INDEX idx_revisions_doc_ver ON document_revisions(document_id, version DESC);
CREATE INDEX idx_revisions_doc_created ON document_revisions(document_id, created_at DESC);

CREATE TABLE document_edit_locks (
  document_id       UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL,
  acquired_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL
);
```

### Failure Modes & Breaking Change Policy

| Failure Mode | Detection | Mitigation |
|---|---|---|
| Edit lock expiry during active edit | Lock auto-released while user is editing | Client must extend lock proactively; debounce rapid extend calls |
| Revision version gap after concurrent conflict | `revision_conflict` error | Client must refresh from head and retry save |
| Lock registry unavailable | Lock state queries fail | Fall back to pessimistic locking; alert operator |
| Document content exceeds storage limits | Provider returns payload too large | Chunk content or store reference to external blob |

**Breaking Changes:** Revision content format changes (e.g., switching from plain text to structured JSON) require a migration. All existing revisions must remain readable in the old format. Lock TTL maximum reduction is breaking if clients expect longer lock durations.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `document_editor.<function>`.
* **Telemetry Metrics:**
```
blueprint_documents_total                    gauge { status }
blueprint_document_revisions_total           counter { document_id }
blueprint_document_lock_contention_total     counter { document_id }
blueprint_document_lock_expiry_total         counter { document_id }
blueprint_document_revision_conflict_total   counter { document_id }
blueprint_document_revision_restore_total    counter
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** workspaces, users
* **Emits To:** events
* **Recommends:** storage (for large document content blobs), audit_log, caching (for low-latency lock checking)
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `created_at DESC` on `getRevisionHistory`.
