# Module Contract: `credit_system`

**Version:** 0.1.0

---

### `credit_system`
Internal credit balance system for marketplace wallets, distinct from loyalty or reward points.

**Functions**
```
creditAccount(account_id: any, amount: decimal, reference: string, metadata?: any) → CreditTransaction
debitAccount(account_id: any, amount: decimal, reference: string, metadata?: any) → CreditTransaction
getBalance(account_id: any) → decimal
getTransactionHistory(account_id: any, options?: PaginationOptions) → PaginatedResult<CreditTransaction>
holdCredits(account_id: any, amount: decimal, reference: string, ttl_seconds?: int) → HoldRecord
releaseHold(hold_id: any) → void
settleHold(hold_id: any) → CreditTransaction
transferCredits(from_account: any, to_account: any, amount: decimal, reference: string) → TransferResult
```

**Types**
```
CreditAccount { id, owner_id, owner_type: user | merchant | platform, balance: decimal, hold_balance: decimal, currency, version: int, created_at, updated_at }
CreditTransaction { id, account_id, type: credit | debit | hold | release | transfer_in | transfer_out, amount, balance_before, balance_after, reference, metadata?, created_at }
HoldRecord { id, account_id, amount, reference, expires_at, status: active | released | settled, created_at }
TransferResult { id, from_transaction_id, to_transaction_id, amount, reference, created_at }
PaginationOptions { first: int, after?: string }
```

**Invariants**
- Account balance must never go negative; debit against insufficient balance returns `INSUFFICIENT_CREDITS`
- Transaction reference must be unique per account; duplicate reference returns `DUPLICATE_REFERENCE`
- All balance changes must be recorded as transactions; no direct balance mutations
- `holdCredits` must reserve the amount from the available balance; held credits are unavailable for other operations
- `releaseHold` must return held credits to the available balance
- `settleHold` must convert a hold to a completed debit transaction
- Balance consistency must be maintained via optimistic locking using `version` field
- Transfers must be atomic: debit source and credit destination in a single transaction
- `balance_before` and `balance_after` in transactions must be consistent with the account's state at the time of the operation

**Providers:** built-in PostgreSQL ledger, custom ledger, Stripe Connect, MongoDB with optimistic locking

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong` (serializable isolation for balance operations)
* **Details:** All balance-affecting operations must use serializable or pessimistic locking to prevent race conditions

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once`
* **Details:** Balance operations are synchronous; idempotency prevents duplicate application

### Worker Scaling
* **Policy:** Account-level locking ensures sequential processing per account; different accounts may be processed in parallel

### Multi-Region Behavior
* **Mode:** Accounts are region-local; cross-region transfers require two-phase commit or saga
* **Details:** Credits are not transferable across regions without a settlement process

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).
* Credit-specific errors: `INSUFFICIENT_CREDITS`, `DUPLICATE_REFERENCE`, `HOLD_EXPIRED`, `HOLD_NOT_FOUND`, `ACCOUNT_VERSION_CONFLICT`, `NEGATIVE_AMOUNT`, `CURRENCY_MISMATCH`

### Idempotency Requirements
* **Standard:** All state-mutating functions accept an optional `idempotency_key` parameter. Keys must be retained for at least 24 hours.
* **Required Functions:**
  - `creditAccount(account_id, amount, reference, metadata?, idempotency_key?)`
  - `debitAccount(account_id, amount, reference, metadata?, idempotency_key?)`
  - `transferCredits(from_account, to_account, amount, reference, idempotency_key?)`

### Event Emission
```
creditAccount       → credit.account.credited       { account_id, amount, reference, balance_after }
debitAccount        → credit.account.debited        { account_id, amount, reference, balance_after }
holdCredits         → credit.account.hold_created   { account_id, amount, reference, expires_at }
releaseHold         → credit.account.hold_released  { hold_id, account_id, amount }
settleHold          → credit.account.hold_settled   { hold_id, account_id, amount }
transferCredits     → credit.account.transferred    { from_account, to_account, amount, reference }
```

### Temporal Constraints
```
Hold TTL:
    default_ttl:   1 hour (configurable per hold)
    max_ttl:       7 days
    on_expire:     auto-release hold; log audit event

Transaction retention:
    retention:     indefinite (compliance requirement)
```

### Storage Model
* **Model:** Append-only ledger with materialized account balance
* **Details:** The account balance is a materialized snapshot computed from the transaction log. The transaction log is append-only and immutable after creation.

### Observability
* **Tracing Spans:** Every credit operation creates a span. Span names follow `credit.<function>`.
* **Telemetry Metrics:**
```
blueprint_credit_operation_total              counter { function, result }
blueprint_credit_operation_duration_ms        histogram { function }
blueprint_credit_account_balance             gauge { owner_type }
blueprint_credit_hold_amount                gauge
blueprint_credit_transactions_total          counter { type }
blueprint_credit_errors_total               counter { function, error_code }
blueprint_credit_version_conflicts_total     counter
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** idempotency_key_standard, pagination_standard
* **Emits To:** events
* **Recommends:** audit_log

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE credit_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      TEXT NOT NULL,
  owner_type    TEXT NOT NULL CHECK (owner_type IN ('user', 'merchant', 'platform')),
  balance       DECIMAL(20,4) NOT NULL DEFAULT 0,
  hold_balance  DECIMAL(20,4) NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'USD',
  version       INT NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, owner_type)
);

CREATE TABLE credit_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES credit_accounts(id),
  type            TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'hold', 'release', 'settle', 'transfer_in', 'transfer_out')),
  amount          DECIMAL(20,4) NOT NULL,
  balance_before  DECIMAL(20,4) NOT NULL,
  balance_after   DECIMAL(20,4) NOT NULL,
  reference       TEXT NOT NULL,
  metadata        JSONB DEFAULT '{}',
  idempotency_key TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_credit_tx_reference ON credit_transactions(account_id, reference);
CREATE INDEX idx_credit_tx_account ON credit_transactions(account_id, created_at DESC);
CREATE INDEX idx_credit_tx_idempotency ON credit_transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE credit_holds (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID NOT NULL REFERENCES credit_accounts(id),
  amount        DECIMAL(20,4) NOT NULL,
  reference     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released', 'settled')),
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_holds_account ON credit_holds(account_id, status);
CREATE INDEX idx_credit_holds_expires ON credit_holds(expires_at) WHERE status = 'active';
```

### Breaking Change Policy
- Adding new transaction types is backward-compatible.
- Changing the decimal precision requires a MAJOR version bump.
- Removing support for a currency requires a MAJOR version bump.
- Changing the hold expiry behavior requires a MINOR version bump.
- Adding new fields to transaction metadata is backward-compatible.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Insufficient credits | Debit exceeds available balance | Reject with INSUFFICIENT_CREDITS; return current balance |
| Duplicate reference | Same reference submitted twice | Reject with DUPLICATE_REFERENCE; return original transaction |
| Version conflict | Concurrent balance modification | Retry with fresh version; log conflict metric |
| Hold expired | Hold not settled or released before TTL | Auto-release hold; log audit event |
| Negative amount | Negative value passed to credit/debit | Reject with NEGATIVE_AMOUNT; validate at API boundary |
| Transfer partial failure | Debit succeeds but credit fails (e.g., DB crash) | Use atomic transaction; if not possible, emit compensating event |
