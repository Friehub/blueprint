# Policy Contract: `database_migrations`
**Version:** 1.0.0

## Scope
Database schema design, query patterns, and migration pathways across all Friehub services.

## Rules
- **Rule 1 (Zero Downtime Alterations):** All schema alterations must follow the expand-contract pattern. Direct column rename or drop is strictly forbidden. A schema migration must be split into:
  1. Expand: Add new column, table, or relation.
  2. Write: Double-write to both new and old fields from the application layer.
  3. Backfill: Migrate historical data asynchronously in batches (no single massive transaction).
  4. Read: Shift all read traffic to the new field/table.
  5. Contract: Disable double-write and drop the old field/table in a separate deployment phase.
- **Rule 2 (Constraint Modifications):** Introducing a new `NOT NULL` constraint on an existing column requires adding it with a default value, backfilling, and then removing the default, or validating it with a separate transient check constraint to avoid locking the table.
- **Rule 3 (Index Coverage):** Indexes must be explicitly defined for:
  - All foreign key columns.
  - Columns used in pagination sort keys (e.g., `created_at` or `id`).
  - Common filter combinations (via composite indexes).
  - Soft-delete queries (via partial indexes, e.g., `WHERE deleted_at IS NULL`).
- **Rule 4 (Large-Table Indexing):** In PostgreSQL, any index creation on a table estimated to hold more than 100,000 rows must use `CREATE INDEX CONCURRENTLY` to avoid blocking concurrent write transactions.
- **Rule 5 (No SELECT *):** All queries must select explicit column lists to minimize network serialization overhead and avoid breakage when tables undergo expansion.
- **Rule 6 (Pagination):** Offsets are forbidden for result sets likely to exceed 1,000 rows. Cursor-based pagination (`id > cursor ORDER BY id LIMIT x`) is the default.
- **Rule 7 (Multi-Tenant Isolation):** Every multi-tenant database table must include a `tenant_id` column and enforce tenant isolation at the database layer (e.g., PostgreSQL Row-Level Security) with a default-deny policy.
