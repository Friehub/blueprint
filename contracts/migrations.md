# Module Contract: `migrations`

**Version:** 0.1.0

---

### `migrations`
Schema migration management with versioning, rollback, and drift detection.

**Functions**
```
createMigration(name, options?) → MigrationPlan
applyPending(options?) → MigrationResult
rollback(steps?, options?) → MigrationResult
getStatus() → MigrationStatus
getHistory(options?) → PaginatedResult<MigrationRecord>
validateDrift() → DriftReport
baseline(version) → void
lockMigrations() → void
unlockMigrations() → void
```

**Types**
```
MigrationPlan { id, name, version, up_sql, down_sql, checksum, created_at }
MigrationResult { applied, rolled_back, duration_ms, records: MigrationRecord[] }
MigrationRecord { version, name, applied_at, duration_ms, checksum, type: apply|rollback|baseline }
MigrationStatus { current_version, pending, locked, last_applied_at, total_applied }
DriftReport { has_drift, differences: SchemaDiff[], severity: none|warning|critical }
SchemaDiff { object_type, object_name, expected, actual, impact }
MigrationOptions { dry_run?, timeout?, lock_timeout? }
```

**Invariants**
- Migrations must be applied in version order -- skipping a version is a contract violation
- `rollback` must revert migrations in reverse order of application, one step at a time
- `validateDrift` must compare the current database schema against the cumulative expected schema, not just the latest migration

**Providers:** Flyway, Alembic, Prisma Migrate, node-pg-migrate, Knex Migrate, goose

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Migration state must be strongly consistent to prevent double-apply or partial application

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for migration events.
* **Details:** Apply is idempotent; a migration already recorded in the history table is skipped.

### Worker Scaling
* **Policy:** Only one process may run migrations at a time; uses a migration lock to enforce this.

### Multi-Region Behavior
* **Mode:** Migrations run on a single (primary) region; replicas follow asynchronously.
* **Details:** Rollback must reverse changes on the primary; replica resync is an operational concern.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* Long-running migrations must report progress; the lock timeout prevents indefinite blocking.

### Error Taxonomy
### Module-Specific Errors
```
applyPending:
    migration_locked:       Another process holds the migration lock | retry after lock timeout
    migration_failed:       Migration N failed | check error details; do not retry without rollback

  rollback:
    cannot_rollback:        Migration has no down SQL defined | manual intervention required
    rollback_failed:        Rollback of migration N failed | check error details

  validateDrift:
    drift_critical:         Schema drift detected that may cause data loss | stop deployment
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
applyPending     → migration.applied           { version, name, duration_ms }
  rollback        → migration.rolled_back        { version, name, duration_ms }
  baseline        → migration.baseline           { version }
  validateDrift   → migration.drift_detected     { severity, diff_count }
```

### Temporal Constraints
```
Migration lock:
    duration:       configurable, default 10 minutes
    on_expiry:      lock released automatically; pending apply fails with migration_locked

  Apply timeout per migration:
    default:        5 minutes
    on_expiry:      mark migration as failed; require manual resolution
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `migrations.<function>`.
* **Telemetry Metrics:**
```
blueprint_migrations_applied_total              { result }
  blueprint_migrations_duration_ms                histogram
  blueprint_migrations_pending_current            gauge
  blueprint_migrations_drift_severity             gauge { severity }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return provider_error, do not retry indefinitely |
| Lock acquisition timeout | Return migration_locked; retry after lock_timeout expires |
| Migration SQL failure | Return migration_failed with error details; require manual resolution before retry |
| Rollback with missing down SQL | Return cannot_rollback; require manual DBA intervention |
| Schema drift detected | Return drift_critical if drift may cause data loss; stop deployment |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new migration record type enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise

### Module Dependencies
* **Depends On:** (none -- infrastructure primitive)
* **Emits To:** events
* **Recommends:** audit_log, connection_pool
