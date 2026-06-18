# Module Contract: `database_migrations`

**Version:** 0.1.0

---

### `database_migrations`
Migration lifecycle management for schema evolution with version ordering and rollback safety.

**Functions**
```
createMigration(name: string, up_sql: string, down_sql?: string) → Migration
applyMigration(migration_id: any) → MigrationResult
rollback(migration_id: any, options?: RollbackOptions) → MigrationResult
getStatus(migration_id: any) → MigrationStatus
listMigrations(filters?: any) → Migration[]
getPendingMigrations() → Migration[]
getAppliedMigrations() → Migration[]
validateMigration(migration: Migration) → ValidationResult
```

**Types**
```
Migration { id, version: string, name, description?, up_sql: string, down_sql?: string, checksum: string, status: pending | applied | failed | rolled_back, applied_at?, rolled_back_at?, duration_ms?, created_at }
MigrationStatus { id, version, name, status, applied_at, rolled_back_at, duration_ms, error_message?, checksum_valid: bool }
MigrationResult { migration_id, version, status, applied_queries: int, duration_ms, error_message? }
RollbackOptions { target_version?: string, force?: bool, dry_run?: bool }
ValidationResult { valid: bool, errors: ValidationError[] }
ValidationError { code: string, message: string }
```

**Invariants**
- Migrations must be ordered by version; versions must be sortable strings (typically semver or timestamp)
- Rollback must be tested before apply; migrations without `down_sql` must not be deployed to production
- Each migration must be applied exactly once; duplicate application returns `ALREADY_APPLIED`
- The checksum of a migration must match between creation and apply; modification after creation returns `CHECKSUM_MISMATCH`
- Migrations must be applied in sequential version order; skipping a version returns `VERSION_SKIPPED`
- A failed migration must not leave the database in an inconsistent state; rollback must be attempted
- `down_sql` must successfully revert the changes of `up_sql` when applied to the same schema state

**Providers:** built-in migration runner, Prisma Migrate, Flyway, Liquibase, Alembic, Goose, Django migrations, EF Core migrations

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Migration application and rollback are synchronous; schema state must be consistent across all connections

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once`
* **Details:** Migration state is persisted; in-flight state is tracked in the migration tracking table

### Worker Scaling
* **Policy:** Migrations are single-worker operations; concurrent migration application is prohibited via advisory locks
* **Details:** Only one migration worker may run at a time; other workers wait or skip

### Multi-Region Behavior
* **Mode:** Migrations are applied to each region independently; schema drift between regions is a critical incident
* **Details:** Migration ordering must be coordinated across regions; regions may lag by at most one minor version

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).
* Migration-specific errors: `ALREADY_APPLIED`, `VERSION_SKIPPED`, `CHECKSUM_MISMATCH`, `ROLLBACK_FAILED`, `NO_DOWN_SQL`, `MIGRATION_IN_PROGRESS`, `VERSION_CONFLICT`, `SCHEMA_DRIFT_DETECTED`

### Event Emission
```
createMigration    → migration.created          { migration_id, version, name }
applyMigration     → migration.apply.started    { migration_id, version }
applyMigration     → migration.apply.completed  { migration_id, version, duration_ms }
applyMigration     → migration.apply.failed     { migration_id, version, error_message }
rollback           → migration.rollback.started { migration_id, version, target }
rollback           → migration.rollback.completed { migration_id, version, duration_ms }
rollback           → migration.rollback.failed  { migration_id, version, error_message }
```

### Temporal Constraints
```
Migration lock TTL:
    lock_timeout:   5 minutes
    on_timeout:     release lock; return MIGRATION_IN_PROGRESS to retry

Migration apply timeout:
    per_migration:  30 minutes
    on_timeout:     mark as failed; trigger alert; do not auto-rollback
```

### Storage Model
* **Model:** Migration metadata stored in a tracking table within the same database
* **Details:** The migrations tracking table is the source of truth for schema version. It must not be subject to migrations itself.

### Observability
* **Tracing Spans:** Every migration operation creates a span. Span names follow `migration.<function>`.
* **Telemetry Metrics:**
```
blueprint_migration_operation_total           counter { function, result }
blueprint_migration_operation_duration_ms     histogram { function }
blueprint_migration_applied_total            counter { status }
blueprint_migration_pending_count            gauge
blueprint_migration_errors_total            counter { function, error_code }
blueprint_migration_schema_drift            gauge { region }
```
* **SLO Targets:** Migration apply time is bounded per organizational policy (typically < 5 min per migration).

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events
* **Recommends:** audit_log

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE _migrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version         TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT,
  checksum        TEXT NOT NULL,
  up_sql          TEXT NOT NULL,
  down_sql        TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'failed', 'rolled_back')),
  applied_at      TIMESTAMPTZ,
  rolled_back_at  TIMESTAMPTZ,
  duration_ms     INT,
  error_message   TEXT,
  applied_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_migrations_version ON _migrations(version);
CREATE INDEX idx_migrations_status ON _migrations(status);

CREATE TABLE _migration_locks (
  id              TEXT PRIMARY KEY DEFAULT 'migration_lock',
  locked_by       TEXT,
  locked_at       TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ
);

-- Migration status tracking for advisory locks
-- PostgreSQL advisory lock: pg_try_advisory_lock(unique_migration_id)
```

### Breaking Change Policy
- Adding new status values to Migration is backward-compatible.
- Changing the version format requires a MAJOR version bump and a migration of the tracking table.
- Removing the tracking table or changing its structure requires a MAJOR version bump.
- Making down_sql required for all migrations requires a MINOR version bump.
- Changing the lock mechanism requires a MAJOR version bump.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Migration already applied | Duplicate migration run | Skip with ALREADY_APPLIED; return current status |
| Version skipped | Migration with version ordering gap | Reject with VERSION_SKIPPED; require all intermediate migrations |
| Migration failed mid-way | SQL error in up migration | Mark as failed; attempt rollback; alert operator |
| Checksum mismatch | Migration file altered after apply | Reject with CHECKSUM_MISMATCH; require manual resolution |
| No down SQL | Rollback attempted on migration without down_sql | Reject with NO_DOWN_SQL; require manual schema fix |
| Concurrent migration run | Two workers start migration simultaneously | Advisory lock prevents second worker; second worker exits with MIGRATION_IN_PROGRESS |
| Schema drift | Hand-applied schema change diverges from migration state | Detect via schema comparison; flag as SCHEMA_DRIFT_DETECTED |
