# Module Contract: `feature_auditing`

**Version:** 0.1.0

---

### `feature_auditing`
Feature flag and rollout history, assignment decisions, and governance audit trails.

**Functions**
```
getFeatureAuditTrail(flag_key, options?) → PaginatedResult<FeatureAuditEntry>
getFeatureAuditEntry(entry_id) → FeatureAuditEntry
listFeatureAuditEntries(input, options?) → PaginatedResult<FeatureAuditEntry>
exportFeatureAudit(filters, format) → FeatureAuditExport
compareFeatureVersions(flag_key, from_version, to_version) → FeatureDiff
```

**Types**
```
FeatureAuditEntry { id, flag_key, action, actor_id?, before?, after?, created_at }
FeatureAuditExport { id, status, format, created_at, expires_at?, url? }
FeatureDiff { flag_key, from_version, to_version, changes }
FeatureAuditAction = created | updated | archived | rollout_started | rollout_changed | rollout_completed | reverted | evaluated
```

**Invariants**
- Feature audit records must be immutable.
- Audit trails must preserve before/after snapshots where available.
- Exporting audit data must not mutate the audit source.

**Providers:** internal audit stores, LaunchDarkly export logs, Unleash audit trails, GrowthBook audit APIs

---

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Feature audit entries must be durably recorded before they are exposed to queries

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for audit lifecycle events.
* **Details:** Duplicate audit entries must be idempotent on the audit action identity.

### Worker Scaling
* **Policy:** Audit ingestion and export generation must be independently scalable.

### Multi-Region Behavior
* **Mode:** Audit data is global; export artifacts may be served from the nearest region.
* **Details:** Cross-region audit queries must be routed to the region containing the primary store.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If audit ingestion is saturated, the module must reject predictably rather than dropping entries.

### Error Taxonomy
### Module-Specific Errors
```
getFeatureAuditTrail:
    flag_not_found:         Feature flag key does not exist | check flag_key

  exportFeatureAudit:
    export_too_large:       Export exceeds maximum size | narrow filters or split
    export_not_ready:       Export is still being generated | poll status

  compareFeatureVersions:
    feature_diff_unavailable: Diff cannot be computed for these versions | check version range
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
getFeatureAuditEntry → feature_audit.entry.created   { entry_id, flag_key, action }
exportFeatureAudit   → feature_audit.export.requested { export_id, format }
                     → feature_audit.export.completed  { export_id, url }
                      OR feature_audit.export.failed   { export_id, reason }
```

### Temporal Constraints
```
Audit retention:
    retention:         configurable per compliance policy
    on_expiry:         archive before purge; maintain hash chain integrity

  Export artifact TTL:
    default:           configurable, minimum 1 hour
    on_expiry:         artifact deleted; re-export required
```

### Storage Model
* **Model:** Append-only feature audit store with export artifacts.
* **Details:** Audit entries must be immutable after creation. Export artifacts are temporary and must be regenerated on demand.

### Database Schema

#### PostgreSQL
```sql
CREATE TYPE feature_audit_action AS ENUM (
  'created', 'updated', 'archived', 'rollout_started', 'rollout_changed',
  'rollout_completed', 'reverted', 'evaluated'
);

CREATE TABLE feature_audit_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key          TEXT NOT NULL,
  action            feature_audit_action NOT NULL,
  actor_id          UUID,
  before            JSONB,
  after             JSONB,
  idempotency_key   TEXT UNIQUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_flag_key ON feature_audit_entries(flag_key, created_at DESC);
CREATE INDEX idx_audit_actor ON feature_audit_entries(actor_id);
CREATE INDEX idx_audit_action ON feature_audit_entries(action);

CREATE TABLE feature_audit_exports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format            TEXT NOT NULL CHECK (format IN ('json', 'csv')),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  url               TEXT,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Failure Modes & Breaking Change Policy

| Failure Mode | Detection | Mitigation |
|---|---|---|
| Audit entry missing after write | Query returns no entry | Check idempotency; retry write if no key collision |
| Export generation timeout | `export_not_ready` persists | Cancel export; retry with smaller filter window |
| Hash chain integrity violation | `verifyChain` detects break | Isolate affected entries; restore from backup |
| Storage full for audit append | Write failure | Alert operator; rotate to warm storage |

**Breaking Changes:** Changing the `FeatureAuditAction` enum is breaking if existing audit entries reference removed values. New action values are non-breaking. The audit entry schema is append-only; field additions must be optional.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `feature_auditing.<function>`.
* **Telemetry Metrics:**
```
gensense_feature_auditing_entries_total          { action }
gensense_feature_auditing_export_total           { format, status }
gensense_feature_auditing_flag_count             gauge { action }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** feature_flags
* **Emits To:** events
* **Recommends:** audit_log, storage, users
