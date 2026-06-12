# Module Contract: `collaborative_editing`

**Version:** 0.1.0

---

### `collaborative_editing`
Concurrent document editing with CRDT-based conflict resolution and cursor awareness.

**Functions**
```
openDocument(doc_id, user_id) → DocumentSession
getDocument(doc_id) → Document
closeDocument(doc_id, user_id) → void
applyOperation(doc_id, operation) → OperationAck
getOperations(doc_id, since_version) → Operation[]
getCursors(doc_id) → CursorPosition[]
updateCursor(doc_id, user_id, position) → void
getDocumentHistory(doc_id) → HistoryEntry[]
resolveConflict(doc_id, operation_a, operation_b) → ResolvedOperation
```

**Types**
```
DocumentSession { id, doc_id, user_id, opened_at, last_activity }
Document { id, content, version, cursors: CursorPosition[], created_at, updated_at }
Operation { id, doc_id, user_id, type: insert|delete|update, position, data, version, timestamp }
OperationAck { operation_id, version, applied: bool, conflict_resolution? }
CursorPosition { user_id, doc_id, position, selection_start?, selection_end?, last_updated }
HistoryEntry { version, user_id, timestamp, operation_count, snapshot? }
ResolvedOperation { operation_id, resolution: a_wins|b_wins|merge, merged_operation? }
```

**Invariants**
- Operations must be applied in causal order -- concurrent operations must be merged using CRDT semantics
- A document's version must increment monotonically with each applied operation, never decrement
- `getDocument` must return the document state at the latest applied version -- partial application must not be visible

**Providers:** Yjs, Automerge, ShareJS, Liveblocks, custom (CRDT)

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual` with causal ordering for operations within a document
* **Details:** CRDT convergence ensures all replicas reach the same state given the same set of operations

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for operation broadcast.
* **Details:** Duplicate operations with the same operation_id must be deduplicated.

### Worker Scaling
* **Policy:** Document sessions must be independently scalable per document shard.

### Multi-Region Behavior
* **Mode:** Active/active with CRDT convergence across regions.
* **Details:** Cross-region latency affects convergence time but not correctness.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If operation throughput exceeds processing capacity, the module must batch operations rather than dropping them.

### Error Taxonomy
### Module-Specific Errors
```
applyOperation:
    doc_not_found:             Document does not exist | verify doc_id
    version_conflict:          Operation version does not match document's current version | pull latest and retry
    operation_invalid:         Operation type or position is invalid for current document state | validate before retry
    session_expired:           Document session has timed out | call openDocument first

  openDocument:
    doc_locked:                Document is locked by another session | retry or request unlock
    max_sessions_reached:      Concurrent session limit for this document exceeded | retry after session close

  getDocument:
    doc_not_found:             Document does not exist | verify doc_id
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
applyOperation    → document.operation.applied   { doc_id, version, user_id }
  openDocument      → document.opened              { doc_id, user_id }
  closeDocument     → document.closed               { doc_id, user_id }
```

### Temporal Constraints
```
Session timeout:
    default:        30 minutes of inactivity
    on_expiry:      close session; preserve document state

  Operation history retention:
    duration:       30 days
    on_expiry:      compact operations into snapshot
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `collaborative_editing.<function>`.
* **Telemetry Metrics:**
```
blueprint_collaborative_editing_active_sessions_total  { doc_id }
  blueprint_collaborative_editing_operations_total       { type }
  blueprint_collaborative_editing_conflicts_total
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Storage Model
* **Model:** Durable document store with append-only operation log. Session state is ephemeral.
* **Details:** The document body, version, and operation history must be persisted. Cursor positions are ephemeral with TTL. Operation history is append-only and compacted into snapshots periodically.

### Database Schema

#### PostgreSQL
```sql
CREATE TYPE operation_type AS ENUM ('insert', 'delete', 'update');

CREATE TABLE collaborative_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content         TEXT NOT NULL DEFAULT '',
  version         BIGINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE collaborative_operations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id          UUID NOT NULL REFERENCES collaborative_documents(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  operation_type  operation_type NOT NULL,
  position        INT NOT NULL,
  data            TEXT NOT NULL,
  version         BIGINT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_collab_ops_doc_version ON collaborative_operations(doc_id, version);

CREATE TABLE collaborative_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id          UUID NOT NULL REFERENCES collaborative_documents(id) ON DELETE CASCADE,
  version         BIGINT NOT NULL,
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_collab_snapshots_doc ON collaborative_snapshots(doc_id, version DESC);

CREATE TABLE collaborative_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id          UUID NOT NULL REFERENCES collaborative_documents(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_collab_sessions_active ON collaborative_sessions(doc_id, last_activity DESC);
```

### Module Dependencies
* **Depends On:** document_editor, users
* **Emits To:** events
* **Recommends:** presence, live_updates, storage
