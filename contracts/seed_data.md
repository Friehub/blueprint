# Module Contract: `seed_data`

**Version:** 0.2.1

---

### `seed_data`
Environment seeding with baseline data, snapshots, and restore capabilities.

**Functions**
```
createSeed(name, data, options?) → Seed
listSeeds(environment?) → Seed[]
applySeed(seed_id, environment) → SeedResult
snapshot(environment, name?) → Snapshot
listSnapshots(environment?) → Snapshot[]
restoreSnapshot(snapshot_id) → RestoreResult
resetToBaseline(environment) → ResetResult
deleteSeed(seed_id) → void
```

**Types**
```
Seed { id, name, environments, data_sources, checksum, created_at }
SeedResult { seed_id, environment, records_created, duration_ms }
Snapshot { id, environment, name, created_at, size_bytes, table_count }
RestoreResult { snapshot_id, environment, tables_restored, duration_ms }
ResetResult { environment, tables_cleared, baseline_applied, duration_ms }
SeedOptions { truncate_first?, order?, dependencies? }
```

**Invariants**
- `resetToBaseline` must truncate all application tables before applying seed data -- cascading deletes are insufficient
- A seed must not be applied to a production environment unless the seed explicitly declares production_safe: true
- `restoreSnapshot` must be atomic at the transaction level where the backend supports it

**Providers:** custom, database dump/restore, factory_bot, Prisma seed, SQL seed files

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Seed application and snapshot restore must be transactional

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for seed and snapshot events.
* **Details:** Applying the same seed twice must be idempotent (data upsert or truncate-then-insert).

### Worker Scaling
* **Policy:** Seed data application and snapshot operations must be serialised per environment.

### Multi-Region Behavior
* **Mode:** Seeds and snapshots are per-database-instance; cross-region seeding is an explicit multi-target operation.
* **Details:** Snapshot restore in one region must not affect data in other regions.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* Large seed files must be streamed or chunked; the module must report progress rather than blocking indefinitely.

### Error Taxonomy
### Module-Specific Errors
```
applySeed:
    not_production_safe:    Seed does not declare production safety | use dev/staging environment only
    seed_conflict:          Seed data conflicts with existing records and truncate_first not set | enable truncate or resolve conflicts

  restoreSnapshot:
    snapshot_stale:         Snapshot is older than maximum restore window | seed from baseline instead
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
applySeed        → seed.applied                { seed_id, environment, records_created }
  snapshot        → seed.snapshot.created        { snapshot_id, environment }
  restoreSnapshot → seed.snapshot.restored       { snapshot_id, environment }
  resetToBaseline → seed.baseline_reset          { environment }
```

### Temporal Constraints
```
Snapshot retention:
    default:        7 days
    on_expiry:      eligible for deletion

  Snapshot restore window:
    max_age:        30 days
    on_expiry:      return snapshot_stale; recommend baseline reseed
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `seed_data.<function>`.
* **Telemetry Metrics:**
```
blueprint_seed_data_applied_total               { environment }
  blueprint_seed_data_snapshot_size_bytes        gauge
  blueprint_seed_data_operation_duration_ms       histogram { operation }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** migrations, config
* **Emits To:** events
* **Recommends:** audit_log
