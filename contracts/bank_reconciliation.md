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

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Statement ingestion and match writes must be durably recorded before exposure.
- **Idempotency:** `createBankReconciliationRun` and `resolveStatementMatch` must be idempotent on run or line identity.
- **Storage Model:** Durable statement match store with bank audit history.
- **Dependencies:** `ledger`, `transfers`, `bank_accounts`, `reconciliation`, `audit_log`, `storage`.
- **Errors:** `BANK_RUN_NOT_FOUND`, `STATEMENT_LINE_NOT_FOUND`, `MATCH_ALREADY_RESOLVED`, `RUN_ALREADY_CLOSED`, `STATEMENT_UNAVAILABLE`, `ACCOUNT_NOT_LINKED`.
