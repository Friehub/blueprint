# Module Contract: `bank_reconciliation`

**Version:** 0.1.0

---

### `bank_reconciliation`
Matching bank statements, balances, and external account activity to internal financial records.

**Functions**
```
createBankReconciliationRun(input) → BankReconciliationRun
getBankReconciliationRun(run_id) → BankReconciliationRun
listBankReconciliationRuns(input, options?) → PaginatedResult<BankReconciliationRun>
getStatementMatches(run_id, options?) → PaginatedResult<StatementMatch>
resolveStatementMatch(match_id, resolution) → StatementMatch
closeBankReconciliationRun(run_id) → BankReconciliationRun
```

**Types**
```
BankReconciliationRun { id, account_id, statement_period, status, matched_count, unmatched_count, created_at, completed_at? }
StatementMatch { id, run_id, statement_line_ref, internal_ref?, amount, currency, status, created_at, resolved_at? }
BankReconciliationStatus = pending | running | matched | partially_matched | failed | closed
```

**Invariants**
- Statement lines must be matched deterministically for the same inputs.
- A run must not alter bank statement source data.
- Closed runs cannot be changed without reopening or creating a new run.

**Providers:** bank statement processors, Plaid/TrueLayer exports, treasury reconciliation backends, ERP bank reconciliation tools

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Match state and run status must be immediately consistent to prevent double-resolution or conflicting match states

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for reconciliation lifecycle events.
* **Details:** Duplicate match events must not double-apply a resolution.

### Worker Scaling
* **Policy:** Statement ingestion, matching engine, and report generation must be independently scalable.

### Multi-Region Behavior
* **Mode:** Bank reconciliation is per-ledger and scoped to the ledger's primary region.
* **Details:** Statements from cross-region bank accounts must be ingested into the ledger's primary region for matching.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Required Functions:**
  - `createBankReconciliationRun(input, idempotency_key?)`
  - `resolveStatementMatch(match_id, resolution, idempotency_key?)`
  - `closeBankReconciliationRun(run_id, idempotency_key?)`

### Backpressure
* If the matching engine is saturated, statement ingestion must queue lines and report a `running` status rather than dropping lines silently.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).
* Domain errors: `BANK_RUN_NOT_FOUND`, `STATEMENT_LINE_NOT_FOUND`, `MATCH_ALREADY_RESOLVED`, `RUN_ALREADY_CLOSED`, `STATEMENT_UNAVAILABLE`, `ACCOUNT_NOT_LINKED`, `MATCH_ENGINE_UNAVAILABLE`, `RUN_IN_PROGRESS`.

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createBankReconciliationRun → reconciliation.run.created      { run_id, account_id, statement_period }
resolveStatementMatch       → reconciliation.match.resolved   { match_id, run_id, resolution }
                           OR reconciliation.match.unmatched  { match_id, run_id }
closeBankReconciliationRun  → reconciliation.run.closed       { run_id, matched_count, unmatched_count }
```

### Temporal Constraints
```
Reconciliation run:
    default_timeout:    24 hours
    on_exceed:          status → failed; partial matches preserved

    statement_ingestion:
        default_window: 90 days lookback
        on_exceed:      STATEMENT_UNAVAILABLE; reconfirm with provider

    match_resolution_window:
        default:        72 hours after run creation
        on_exceed:      escalate; unresolved matches flagged for manual review

    closed run lock:
        policy:         immutable after close
        on_modify:      RUN_ALREADY_CLOSED; must create new run
```

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE bank_reconciliation_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID NOT NULL,
  statement_period  TSTZRANGE NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'running', 'matched', 'partially_matched', 'failed', 'closed')),
  matched_count     INTEGER NOT NULL DEFAULT 0,
  unmatched_count   INTEGER NOT NULL DEFAULT 0,
  total_lines       INTEGER NOT NULL DEFAULT 0,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  EXCLUDE USING gist (account_id WITH =, statement_period WITH &&)
);

CREATE INDEX idx_recon_runs_account ON bank_reconciliation_runs(account_id, created_at DESC);

CREATE TABLE bank_statement_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL REFERENCES bank_reconciliation_runs(id) ON DELETE CASCADE,
  external_ref    TEXT NOT NULL,
  amount          NUMERIC(19,4) NOT NULL,
  currency        TEXT NOT NULL,
  description     TEXT,
  transaction_date TIMESTAMPTZ NOT NULL,
  raw_data        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, external_ref)
);

CREATE INDEX idx_statement_lines_run ON bank_statement_lines(run_id);

CREATE TABLE bank_statement_matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL REFERENCES bank_reconciliation_runs(id) ON DELETE CASCADE,
  line_id         UUID NOT NULL REFERENCES bank_statement_lines(id) ON DELETE CASCADE,
  internal_ref    TEXT,
  amount          NUMERIC(19,4) NOT NULL,
  currency        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'unmatched'
                    CHECK (status IN ('unmatched', 'matched', 'pending_review', 'resolved')),
  resolution      TEXT,
  resolved_by     UUID,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, line_id)
);

CREATE INDEX idx_statement_matches_run ON bank_statement_matches(run_id, status);
CREATE INDEX idx_statement_matches_status ON bank_statement_matches(status) WHERE status = 'unmatched';
```

### Storage Model
* **Model:** Durable statement match store with bank audit history.
* **Details:** Statement lines are append-only; matches are mutable until the run is closed. All mutations are audited.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `bank_reconciliation.<function>`.
* **Telemetry Metrics:**
```
blueprint_bank_reconciliation_operation_total            counter { function, result }
blueprint_bank_reconciliation_operation_duration_ms      histogram { function }
blueprint_bank_reconciliation_errors_total               counter { function, error_code }
blueprint_bank_reconciliation_runs_total                  counter { status }
blueprint_bank_reconciliation_match_rate                  gauge { account_id }
blueprint_bank_reconciliation_matches_resolved_total      counter { resolution }
blueprint_bank_reconciliation_run_duration_ms             histogram { account_id }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** bank_accounts, ledger
* **Emits To:** events
* **Recommends:** transfers, audit_log, notifications, reporting

### Breaking Change Policy
- Adding a new match resolution value is additive and backward-compatible.
- Removing or renaming an existing run status requires a MAJOR version bump.
- Changing the matching algorithm in a way that alters existing match results requires a MAJOR version bump.
- Adding new required fields to `createBankReconciliationRun` input requires a MAJOR version bump.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Statement ingestion timeout | Provider API unavailability | Queue and retry with backoff; mark run as failed after 3 attempts |
| Matching engine failure | Algorithm exception or data inconsistency | Preserve ingested lines; restart matching on new engine instance |
| Duplicate statement line | Provider re-delivers same line | Deduplicate by (run_id, external_ref) unique constraint |
| Match already resolved | Concurrent resolution attempts | MATCH_ALREADY_RESOLVED; return existing resolution |
| Run close with unmatched lines | User closes before full match | Transition to closed; preserve unmatched for next run |
