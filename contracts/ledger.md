# Module Contract: `ledger`

---

### `ledger`
Financial double-entry bookkeeping engine for immutable multi-currency transaction records.

**Functions**
```
createLedger(name, currency) → Ledger
createAccount(ledger_id, type, name?) → LedgerAccount
postTransaction(postings, reference, metadata?) → LedgerTransaction
getAccountBalance(account_id, timestamp?) → LedgerBalance
getLedgerTransactions(filters, options?) → PaginatedResult<LedgerTransaction>
```

**Types**
```
Ledger { id, name, currency, status, created_at }
LedgerAccount { id, ledger_id, type, name?, currency, status, created_at }
LedgerTransaction { id, ledger_id, postings, reference, posted_at, metadata }
Posting { account_id, direction, amount }
LedgerBalance { account_id, balance, timestamp }

LedgerStatus = active | suspended
AccountType = asset | liability | equity | revenue | expense
AccountStatus = active | closed | frozen
PostingDirection = debit | credit
```
*Note on Amounts:* All `amount` fields must be represented as integers in the minor unit of the currency (e.g. cents for USD, to avoid floating point precision issues).

**Invariants**
- **Strict Accounting Balance**: The sum of all `debit` amounts must exactly equal the sum of all `credit` amounts for every single posted transaction. If not, the posting transaction must fail.
- **Immutability**: Once a transaction is posted to the ledger, it can never be edited or deleted. Corrections must be handled by posting a new compensating transaction.
- **Atomicity**: A transaction posting consisting of multiple postings must be committed to the database atomically (all succeed or all fail).
- **Asset/Expense balance**: Debit increases asset and expense account balances, credit decreases them.
- **Liability/Equity/Revenue balance**: Credit increases liability, equity, and revenue account balances, debit decreases them.

**Providers:** custom double-entry database, LedgerSMB, Fragment, Twisp, TigerBeetle

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Financial ledger balance audits must reflect all committed postings immediately.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for ledger lifecycle events.
* **Details:** Duplicate posting retries must not create duplicate postings; reference or idempotency keys must resolve to the original transaction.

### Worker Scaling
* **Policy:** Posting, balance reads, and export workloads must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether the ledger is single-region or active/passive.
* **Details:** Cross-region writes must not violate balance or atomicity.

### Idempotency Requirements
* **Standard:** Idempotency keys must be accepted on transaction postings and retained for 7 days.
* **Required Functions:**
  - `postTransaction(postings, reference, idempotency_key?)`

### Backpressure
* If posting throughput is saturated, the module must defer or reject predictably rather than accepting partial transactions.

### Error Taxonomy
### Module-Specific Errors
```
postTransaction:
    ledger_unbalanced:         The sum of debits does not equal the sum of credits | reject
    account_inactive:          One or more posting accounts are closed or frozen | prompt reactivate
    currency_mismatch:         A posting is routed to an account with a different currency from the ledger | reject
    duplicate_reference:       The idempotency key or reference has already been posted | return original transaction
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createAccount    → ledger.account.created      { account_id, ledger_id, type }
postTransaction  → ledger.transaction.posted   { transaction_id, ledger_id, reference }
```

### Temporal Constraints
```
Ledger retention:
    retention:         configurable per finance/compliance policy
    on_expiry:         archive only if allowed by policy
```

### Storage Model
* **Model:** Immutable double-entry ledger store.
* **Details:** Postings are append-only; corrections must be represented by compensating transactions.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `ledger.<function>`.
* **Telemetry Metrics:**
```
gensense_ledger_postings_total              counter { ledger_id }
gensense_ledger_transactions_total          counter { result: success|failure }
gensense_ledger_account_balance_snapshot    gauge { account_id }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none — owns its own financial ledger data layer)
* **Emits To:** events
* **Recommends:** audit_log, caching (for high-speed balance reads)
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `posted_at DESC` on `getLedgerTransactions`.
