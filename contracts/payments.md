# Module Contract: `payments`

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
- `creditWallet` with the same `reference` must be idempotent — double-crediting must not occur
- `debitWallet` must not reduce balance below zero unless `allow_negative: true` is explicitly passed

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Balance changes must be immediately consistent

### Idempotency Requirements
* **Standard:** Idempotency keys must be accepted on financial operations and retained for 7 days. Reference fields serve as idempotency keys for wallet credits/debits.
* **Required Functions:**
  - `initiatePayment(order_id, amount, currency, method, idempotency_key?)`
  - `creditWallet(user_id, amount, currency, reference, idempotency_key?)`
  - `debitWallet(user_id, amount, currency, reference, idempotency_key?)`
  - `initiateRefund(payment_id, amount?, reason, idempotency_key?)`

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
* None explicitly defined.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `payments.<function>`.
* **Telemetry Metrics:**
```
gensense_payments_initiation_total           { method, currency, result }
  gensense_payments_amount_total               { currency }  ← sum of amounts
  gensense_payments_refund_total               { reason }
  gensense_wallet_balance_snapshot             gauge { currency }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none — wraps external provider + owns wallet)
* **Emits To:** events
* **Recommends:** audit_log, notifications, fraud_detection
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `created_at DESC` on `getWalletTransactions`.
