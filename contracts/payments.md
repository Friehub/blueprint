# Module Contract: `payments`

**Version:** 0.1.0

---

### `payments`
Payment processing and wallet management.

**Functions**
```
initiatePayment(order_id, amount, currency, method) → Payment
verifyPayment(payment_id) → Payment
getPaymentByOrder(order_id) → Payment?
getWallet(user_id) → Wallet
creditWallet(user_id, amount, currency, reference) → WalletTransaction
debitWallet(user_id, amount, currency, reference) → WalletTransaction
getWalletTransactions(user_id, options?) → PaginatedResult<WalletTransaction>
initiateRefund(payment_id, amount?, reason) → Refund
getRefundByOrder(order_id) → Refund?
getRefund(refund_id) → Refund
```

**Types**
```
Payment { id, order_id, amount, currency, status, method, provider_reference, created_at }
Wallet { user_id, balance, currency, locked_balance }
WalletTransaction { id, type: credit|debit, amount, balance_after, reference, created_at }
Refund { id, payment_id, amount, status, reason, created_at }
PaymentMethod = card | bank_transfer | wallet | ussd | qr_code
PaymentStatus = pending | processing | completed | failed | refunded | disputed
```

**Invariants**
- `creditWallet` with the same `reference` must be idempotent -- double-crediting must not occur
- `debitWallet` must not reduce balance below zero unless `allow_negative: true` is explicitly passed

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Balance changes must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for payment lifecycle events.
* **Details:** Duplicate provider callbacks or retries must not duplicate charges or refunds.

### Worker Scaling
* **Policy:** Payment initiation, provider verification, and refund workflows must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether payment processing is single-region or active/passive.
* **Details:** Duplicate cross-region submission must be deduplicated by payment identity.

### Idempotency Requirements
* **Standard:** Idempotency keys must be accepted on financial operations and retained for 7 days. Reference fields serve as idempotency keys for wallet credits/debits.
* **Required Functions:**
  - `initiatePayment(order_id, amount, currency, method, idempotency_key?)`
  - `creditWallet(user_id, amount, currency, reference, idempotency_key?)`
  - `debitWallet(user_id, amount, currency, reference, idempotency_key?)`
  - `initiateRefund(payment_id, amount?, reason, idempotency_key?)`

### Backpressure
* If provider capacity is saturated, the module must defer or reject predictably rather than attempting unbounded retries.

### Error Taxonomy
### Module-Specific Errors
```
initiatePayment:
    insufficient_funds:        Wallet or card balance too low | prompt top-up or alternative method
    card_declined:             Card issuer declined | prompt alternative payment method
    card_expired:              Card past expiry date | prompt card update
    currency_not_supported:    Provider does not support this currency | show supported currencies
    duplicate_reference:       Idempotency key already used with different parameters | return original result
    provider_unavailable:      Payment provider is down | retry with exponential backoff
    fraud_blocked:             Transaction blocked by fraud detection | require manual review
    limit_exceeded:            Transaction exceeds daily or per-transaction limit | inform user of limit

  initiateRefund:
    refund_window_expired:     Refund period has passed | escalate to manual process
    already_refunded:          Payment has already been fully refunded | return existing refund
    partial_refund_not_supported: Provider does not support partial refunds | refund full amount or reject
    payment_not_settled:       Original payment not yet settled | retry after settlement window

  creditWallet:
    duplicate_credit:          Same reference already credited | return existing transaction (idempotent)

  debitWallet:
    insufficient_balance:      Balance too low and allow_negative not set | return error with current balance
    wallet_frozen:             Wallet is under investigation | return 403
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
initiatePayment   → payment.initiated          { payment_id, order_id, amount, currency, method }
  verifyPayment     → payment.completed          { payment_id, order_id, amount, provider_reference }
                   OR payment.failed             { payment_id, order_id, reason }
  initiateRefund    → payment.refund.initiated   { refund_id, payment_id, amount, reason }
  creditWallet      → wallet.credited            { user_id, amount, currency, balance_after, reference }
  debitWallet       → wallet.debited             { user_id, amount, currency, balance_after, reference }
```

### Temporal Constraints
```
Payment event retention:
    retention:         configurable per regulatory policy
    on_expiry:         archive or purge according to compliance requirements
```

### Storage Model
* **Model:** Strongly consistent financial ledger / payment state store.
* **Details:** Balance and payment records must remain auditable and queryable for the required retention period.

### Database Schema

#### PostgreSQL
```sql
CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded', 'disputed');
CREATE TYPE payment_method AS ENUM ('card', 'bank_transfer', 'wallet', 'ussd', 'qr_code');

CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL,
  amount          BIGINT NOT NULL CHECK (amount > 0),
  currency        CHAR(3) NOT NULL,
  status          payment_status NOT NULL DEFAULT 'pending',
  method          payment_method NOT NULL,
  provider_ref    TEXT,
  idempotency_key TEXT UNIQUE,
  error_code      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_payments_idempotency ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE wallets (
  user_id        UUID PRIMARY KEY,
  balance        BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency       CHAR(3) NOT NULL,
  locked_balance BIGINT NOT NULL DEFAULT 0 CHECK (locked_balance >= 0),
  version        INT NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE wallet_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id     UUID NOT NULL REFERENCES wallets(user_id),
  type          TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount        BIGINT NOT NULL CHECK (amount > 0),
  balance_after BIGINT NOT NULL,
  reference     TEXT NOT NULL,
  idempotency_key TEXT UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wallet_transactions_wallet ON wallet_transactions(wallet_id, created_at DESC);
```

### Distributed System Patterns

**Saga pattern (initiatePayment):**
* Step 1: Create payment record (status: pending) -- local transaction
* Step 2: Call provider (async, with idempotency key)
* Step 3: On provider success: update status → completed, emit PaymentCompleted event
* Compensation: On step 2 failure: update status → failed, emit PaymentFailed, refund if wallet was debited

**Outbox pattern (PaymentCompleted events):**
* Write event to outbox table in same transaction as status update
* Separate worker polls outbox and delivers to event bus
* Guarantees at-least-once delivery even if app crashes after DB write

**Idempotency table (provider webhook deduplication):**
* Table: payment_idempotency_keys (key, result_json, created_at)
* On each webhook: check table first, return cached result if found
* Insert key + result atomically with the state change
* Retain for 7 days

**Optimistic locking (wallet operations):**
* Read wallet with version N
* Apply change (debit/credit)
* UPDATE wallets SET balance = $new, version = N+1 WHERE user_id = $id AND version = N
* If 0 rows updated: retry (max 3) before returning concurrency_conflict

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `payments.<function>`.
* **Telemetry Metrics:**
```
blueprint_payments_initiation_total           { method, currency, result }
  blueprint_payments_amount_total               { currency }  ← sum of amounts
  blueprint_payments_refund_total               { reason }
  blueprint_wallet_balance_snapshot             gauge { currency }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none -- wraps external provider + owns wallet)
* **Emits To:** events
* **Recommends:** audit_log, notifications, fraud_detection
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `created_at DESC` on `getWalletTransactions`.
