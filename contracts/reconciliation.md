# Module Contract: `reconciliation`

---

### `reconciliation`
Matching and discrepancy resolution across financial, operational, and ledger-backed records.

**Functions**
```
createReconciliationRun(input) → ReconciliationRun
getReconciliationRun(run_id) → ReconciliationRun
listReconciliationRuns(input) → PaginatedResult<ReconciliationRun>
getDiscrepancies(run_id, options?) → PaginatedResult<Discrepancy>
resolveDiscrepancy(discrepancy_id, resolution) → Discrepancy
retryRun(run_id) → ReconciliationRun
closeRun(run_id) → ReconciliationRun
```

**Types**
```
ReconciliationRun { id, name, status, source_type, target_type, period_start, period_end, matched_count, unmatched_count, created_at, completed_at? }
Discrepancy { id, run_id, record_key, source_value?, target_value?, diff, status, created_at, resolved_at? }
ReconciliationStatus = pending | running | matched | partially_matched | failed | closed
Resolution = accept_source | accept_target | manual_adjustment | ignore
```

**Invariants**
- Reconciliation must be deterministic for the same inputs and period.
- Reconciliation runs must not mutate source systems; only discrepancy records and run state may change.
- A closed run cannot be resolved further without reopening it.

**Providers:** custom SQL + warehouse jobs, bank statement parsers, ERP exports, payment processor exports, ETL reconciliation tools

---

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Run creation and discrepancy writes must be durably recorded before the run is exposed.
- **Idempotency:** `createReconciliationRun` and `retryRun` must be idempotent on a stable run fingerprint.
- **Temporal Constraints:** Reconciliation snapshots should be bounded by a configured period window; stale inputs must be rejected or re-snapshotted explicitly.
- **Storage Model:** Durable run state, discrepancy store, and reconciliation audit history are required.
- **Dependencies:** `ledger`, `payments`, `orders`, `storage`, `audit_log`, `queues`.
- **Errors:** `RUN_NOT_FOUND`, `RUN_ALREADY_EXISTS`, `DISCREPANCY_NOT_FOUND`, `RUN_NOT_REOPENABLE`, `INVALID_RECONCILIATION_WINDOW`, `SOURCE_SNAPSHOT_UNAVAILABLE`.
