# Module Contract: `reconciliation`

**Version:** 0.2.0

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

### Reconciliation Algorithm

Two strategies are supported. The deployment chooses based on data volume and consistency requirements.

**Strategy 1: Ledger-Diff (default)**
```
1. Snapshot source records for the period: SELECT * FROM source WHERE created_at BETWEEN $period_start AND $period_end
2. Snapshot target records for the period: SELECT * FROM target WHERE created_at BETWEEN $period_start AND $period_end
3. Build a hash map on (record_key) for both source and target
4. For each source record:
     - If key not found in target: record as MISSING_IN_TARGET
     - If key found and values differ: record as VALUE_MISMATCH with source_value, target_value, diff
5. For each target record where key not in source: record as MISSING_IN_SOURCE
6. Unmatched records are Discrepancy entries with status = unmatched
```
Best for: moderate data volumes (< 1M records), real-time reconciliation, high accuracy.

**Strategy 2: Balance-Forward**
```
1. Compute aggregate totals per account: SUM(amount) GROUP BY account_id for the period
2. Compare opening balance + aggregate = closing balance for both source and target
3. If balances match: records are implicitly reconciled
4. If balances mismatch: drill down to individual records using Ledger-Diff on the affected accounts
```
Best for: high-volume systems (> 1M records), batch settlement reconciliation, regulatory reporting.

**Run Execution Model:**
- Runs execute asynchronously via the `queues` module
- Long-running runs checkpoint progress every 1000 records for resumability
- Runs that fail mid-execution are retried from the last checkpoint (max 3 attempts)
### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return provider_error, do not retry indefinitely |
| Provider rate limited | Respect Retry-After header, apply exponential backoff |
| Partial success in batch | Return partial_success with succeeded[] and failed[] |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise

- Stale snapshots (older than 2x the period window) are rejected
