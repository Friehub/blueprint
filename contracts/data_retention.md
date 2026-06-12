# Module Contract: `data_retention`

**Version:** 0.1.0

---

### `data_retention`
Policy-driven data lifecycle management with automated purge and compliance logging.

**Functions**
```
definePolicy(name, config) → RetentionPolicy
getPolicy(policy_id) → RetentionPolicy
listPolicies(scope?) → RetentionPolicy[]
updatePolicy(policy_id, changes) → RetentionPolicy
deletePolicy(policy_id) → void
runPurge(policy_id?) → PurgeResult
previewPurge(policy_id) → PurgePreview
getPurgeHistory(policy_id, options?) → PaginatedResult<PurgeRecord>
exportBeforePurge(policy_id, destination) → ExportResult
```

**Types**
```
RetentionPolicy { id, name, scope, data_category, max_age, action: delete|anonymize|archive, exceptions[], created_at }
PurgeResult { policy_id, records_purged, records_exported, duration_ms, completed_at }
PurgePreview { policy_id, records_affected, estimated_size, tables_affected }
PurgeRecord { id, policy_id, run_at, records_purged, status: completed|failed|partial, error? }
ExportResult { policy_id, records_exported, destination, format, size_bytes }
```

**Invariants**
- Data must never be purged without first checking for a legal hold or active retention exception
- `exportBeforePurge` must complete before any records are deleted -- a failed export must abort the purge
- A policy targeting a data category that overlaps with another policy must apply the longest retention, not the shortest

**Providers:** custom, AWS S3 Lifecycle, GCS Object Lifecycle, Vault (secret rotation)

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Policy configuration must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for purge and export events.
* **Details:** Duplicate purge runs must be idempotent (records already deleted are skipped).

### Worker Scaling
* **Policy:** Policy evaluation, purge execution, and export must be independently scalable.

### Multi-Region Behavior
* **Mode:** Purge operations are per-region; cross-region data must have retention policies declared per region.
* **Details:** A global policy must be replicated to all regions before purge runs in any region.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* Large purge operations must be batched and report progress; the module must not hold a transaction open for the entire purge.

### Error Taxonomy
### Module-Specific Errors
```
runPurge:
    legal_hold_active:       Data subject to legal hold cannot be purged | exclude from purge batch
    export_failed:           Export before purge failed | purge aborted; fix export target

  definePolicy:
    policy_conflict:         Policy overlaps with existing policy on data_category | merge or adjust scope
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
definePolicy     → retention.policy.created    { policy_id, name, data_category }
  runPurge         → retention.purge.started     { policy_id }
                 → retention.purge.completed    { policy_id, records_purged }
                 OR retention.purge.failed      { policy_id, reason }
  exportBeforePurge → retention.export.completed { policy_id, destination, records_exported }
```

### Temporal Constraints
```
Purge scheduling:
    cadence:        configurable per policy (daily, weekly, monthly)
    on_expiry:      purge job is triggered automatically

  Export batch size:
    max_records:    10000 per batch
    on_exceed:      split into multiple export batches
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `data_retention.<function>`.
* **Telemetry Metrics:**
```
gensense_data_retention_policies_total          { status }
  gensense_data_retention_purge_records_total     { policy_id }
  gensense_data_retention_purge_duration_ms        histogram
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** audit_log, consent
* **Emits To:** events
* **Recommends:** notifications, storage (for export destination)
