# Module Contract: `migration_strategies`

**Version:** 0.2.0

---

### `migration_strategies`
Zero-downtime schema migration patterns with expand/contract, dual-write, and rollback procedures.

**Functions**
```
planMigration(name, strategy, steps) → MigrationPlan
validateStrategy(migration_id) → StrategyReport
executeExpandPhase(migration_id) → PhaseResult
executeMigratePhase(migration_id) → PhaseResult
executeContractPhase(migration_id) → PhaseResult
executeDualWrite(migration_id, old_table, new_table) → DualWriteResult
createBackfill(description, query, batch_size) → BackfillJob
rollbackPhase(migration_id) → RollbackResult
```

**Types**
```
MigrationPlan { id, name, strategy, phases: MigrationPhase[], rollback_phases: MigrationPhase[], dry_run: bool }
MigrationPhase { name, type: expand|migrate|contract|dual_write, sql?, risks }
StrategyReport { valid: bool, backward_compatible: bool, estimated_downtime_ms, risks: Risk[] }
PhaseResult { phase, applied: bool, duration_ms, rows_affected?, error? }
DualWriteResult { old_writes, new_writes, conflicts, duration_ms }
BackfillJob { id, query, batch_size, progress_pct, status: running|completed|failed }
RollbackResult { phase, reversed: bool, duration_ms, warning? }
Risk { level: low|medium|high, description, mitigation }
MigrationStrategy = expand_contract | dual_write | background_backfill | no_downtime
```

**Invariants**
- The expand phase must add new columns/tables without removing or altering existing ones -- backward compatibility must be maintained throughout the expand phase
- The contract phase must only remove old columns/tables after the migrate phase has completed and been verified -- removing before verification is a contract violation
- A dual-write migration must verify that both the old and new paths produce the same result for at least `sample_pct` of writes before the cutover
- A migration with `dry_run: true` must not modify any data -- it must only validate the plan against the current schema
- `rollbackPhase` must return the schema to its pre-migration state -- it must not leave partial modifications

**Dependencies:** migrations

**Providers:** Flyway, Alembic, Prisma Migrate, custom

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Migration phase state must be strongly consistent to prevent partial application

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for migration phase execution.
* **Details:** Duplicate phase execution must be idempotent (already-applied phases are skipped).

### Worker Scaling
* **Policy:** Only one migration may run at a time per database cluster.

### Multi-Region Behavior
* **Mode:** Migrations are applied to the primary database first; replicas follow asynchronously.
* **Details:** The contract phase must not run until all replicas have applied the migrate phase.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
### Module-Specific Errors
```
executeExpandPhase:
    backward_incompatible:   Expand phase includes a breaking change | move to migrate or contract phase
    lock_timeout:            Could not acquire migration lock | retry after backoff

  rollbackPhase:
    rollback_not_safe:       Rollback would lose data written during the migrate phase | manual intervention required
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
Phase completion  → migration.strategy.phase_completed { migration_id, phase, duration_ms }
  Rollback          → migration.strategy.rolled_back   { migration_id, phase }
  Validation        → migration.strategy.validated     { migration_id, compatible: bool }
```

### Temporal Constraints
```
Dual-write verification window:
    default:        24 hours
    on_expiry:      migration may proceed to contract phase

  Backfill batch size:
    default:        1000 rows
    on_exceed:      split into smaller batches

  Rollback window:
    duration:       1 hour after contract phase completion
    on_expiry:      rollback requires manual intervention
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `migration_strategies.<function>`.
* **Telemetry Metrics:**
```
blueprint_migration_strategies_total          { strategy, result }
  blueprint_migration_strategies_duration_ms    histogram { phase }
  blueprint_migration_strategies_dual_write_conflicts { migration_id }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return provider_error, do not retry indefinitely |
| Lock timeout during expand phase | Return lock_timeout; retry after backoff |
| Dual-write verification fails | Return conflict details; do not proceed to contract phase |
| Rollback exceeds safe window | Return rollback_not_safe; require manual DBA intervention |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new migration strategy: non-breaking if existing strategies remain supported; breaking otherwise

### Module Dependencies
* **Depends On:** migrations
* **Emits To:** events
* **Recommends:** notifications (for migration completion alerts), audit_log, scheduled_tasks (for backfill scheduling)
