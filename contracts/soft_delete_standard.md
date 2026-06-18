# Module Contract: `soft_delete_standard`

**Version:** 0.1.0

---

### `soft_delete_standard`
Soft deletion standard across all modules; records are marked as deleted rather than removed.

**Functions**
```
softDelete(resource_type: string, resource_id: any, options?: SoftDeleteOptions) → SoftDeleteResult
restore(resource_type: string, resource_id: any, options?: SoftDeleteOptions) → RestoreResult
purge(resource_type: string, resource_id: any, options?: PurgeOptions) → PurgeResult
queryDeleted(resource_type: string, filters?: any, options?: PaginationOptions) → PaginatedResult
```

**Types**
```
SoftDeleteConfig { enabled: bool, deleted_at_field?: string, deleted_by_field?: string, exclude_by_default?: bool }
SoftDeleteOptions { reason?: string, deleted_by?: string, force?: bool }
PurgeOptions { confirm_token: string, reason: string, cascade?: bool }
SoftDeleteResult { id: any, deleted_at: timestamp, deleted_by?: string, reason?: string }
RestoreResult { id: any, restored_at: timestamp, restored_by?: string }
PurgeResult { id: any, purged_at: timestamp, records_affected: int }
```

**Invariants**
- `deleted_at` timestamp must be set to the current time on soft delete
- All queries must exclude soft-deleted records by default unless explicitly requested
- Hard purge must require explicit confirmation via `confirm_token`
- `restore` must clear `deleted_at` and set `restored_at`; it must not restore the original `created_at`
- `purge` must permanently remove the record; purged records must not be recoverable
- Cascading purge must respect foreign key constraints and be performed in dependency order
- Soft-deleted records must still be accessible for direct lookup by ID

**Providers:** built-in PostgreSQL soft delete, MongoDB logical delete flag, Prisma middleware, TypeORM soft delete

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Soft delete status is immediately visible to subsequent queries

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once`
* **Details:** Delete and restore are synchronous operations

### Worker Scaling
* **Policy:** Operations are row-level; no scaling concerns beyond the storage layer

### Multi-Region Behavior
* **Mode:** Soft delete state must replicate consistently; purge operations require region-wide coordination
* **Details:** `purge` must wait for all regions to acknowledge before completing

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).
* Soft-delete-specific errors: `ALREADY_DELETED`, `ALREADY_RESTORED`, `PURGE_CONFIRM_REQUIRED`, `CASCADE_CONSTRAINT_VIOLATION`, `CASCADE_WOULD_ORPHAN`

### Event Emission
```
softDelete    → <resource>.deleted.soft     { resource_type, resource_id, deleted_by, reason }
restore       → <resource>.restored         { resource_type, resource_id, restored_by }
purge         → <resource>.purged           { resource_type, resource_id, purged_by, records_affected }
```

### Temporal Constraints
```
Soft delete retention:
    retention:        indefinite (or configurable per compliance policy)
    on_expire:        only purge when policy explicitly allows it
```

### Storage Model
* **Model:** Logical deletion via timestamp column; records remain in the same table
* **Details:** All tables that support soft delete must include `deleted_at TIMESTAMPTZ` and `deleted_by TEXT` columns

### Observability
* **Tracing Spans:** Every soft delete operation creates a span. Span names follow `soft_delete.<function>`.
* **Telemetry Metrics:**
```
blueprint_soft_delete_operation_total          counter { function, resource_type, result }
blueprint_soft_delete_operation_duration_ms    histogram { function }
blueprint_soft_delete_active_total            gauge { resource_type }
blueprint_soft_delete_purge_total             counter { resource_type }
blueprint_soft_delete_errors_total            counter { function, error_code }
```

### Module Dependencies
* **Depends On:** pagination_standard
* **Emits To:** events
* **Recommends:** audit_log

### Database Schema

#### PostgreSQL
```sql
-- Template for any table supporting soft delete
CREATE TABLE <table_name> (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ... business columns ...
  deleted_at      TIMESTAMPTZ,       -- NULL = active, non-NULL = soft-deleted
  deleted_by      TEXT,              -- actor who performed the delete
  deleted_reason  TEXT,              -- optional reason
  restored_at     TIMESTAMPTZ,       -- set on restore
  restored_by     TEXT,              -- actor who performed the restore
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial index: only active records (for default queries)
CREATE INDEX idx_<table>_active ON <table_name>(created_at DESC) WHERE deleted_at IS NULL;

-- Index for querying deleted records
CREATE INDEX idx_<table>_deleted ON <table_name>(deleted_at DESC) WHERE deleted_at IS NOT NULL;
```

### Breaking Change Policy
- Adding new soft delete columns is backward-compatible.
- Changing the soft delete mechanism (e.g., moving to a separate table) requires a MAJOR version bump.
- Removing the soft delete option and switching to hard delete requires a MAJOR version bump.
- Changing the default query behavior (excluding deleted) requires a MAJOR version bump.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Accidental bulk soft delete | Missing WHERE clause | Require explicit scope limit; log and alert on >100 records |
| Purge without confirm | Missing confirm_token | Reject with PURGE_CONFIRM_REQUIRED |
| Cascade purge orphans child records | Foreign key violation on purge | Prevent purge; return CASCADE_WOULD_ORPHAN |
| Concurrent restore and delete | Race condition | Use row-level locking; last writer wins with audit trail |
| Deleted record referenced externally | Foreign key from other system | Soft delete retains the row; external references remain valid |
