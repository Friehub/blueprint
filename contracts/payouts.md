# Module Contract: `payouts`

**Version:** 0.1.0

---

### `payouts`
Outbound disbursement of funds to vendors, creators, sellers, and bank accounts.

**Functions**
```
createPayout(source_account_id, recipient_id, amount, currency, destination) → Payout
getPayout(payout_id) → Payout
listPayouts(input, options?) → PaginatedResult<Payout>
cancelPayout(payout_id, reason) → Payout
retryPayout(payout_id) → Payout
schedulePayout(source_account_id, destination, schedule) → PayoutSchedule
getPayoutSchedule(schedule_id) → PayoutSchedule
```

**Types**
```
Payout { id, source_account_id, recipient_id, amount, currency, destination, status, created_at, processed_at?, settled_at?, error_details? }
PayoutSchedule { id, source_account_id, destination, cadence, status, next_run_at?, created_at }
PayoutStatus = pending | queued | processing | paid | failed | cancelled | reversed
```

**Invariants**
- Payouts must be backed by available funds before release.
- A paid payout cannot be cancelled; only reversal flows are permitted if supported.
- Scheduled payouts must not execute twice for the same scheduled window.

**Providers:** Stripe Connect, PayPal Payouts, Wise Platform, bank transfer rails, treasury providers

---

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Payout creation and state transitions must be strongly consistent.
- **Idempotency:** `createPayout`, `cancelPayout`, and `retryPayout` must be idempotent on payout identity.
- **Storage Model:** Durable payout ledger with schedule history and reversal trail.
- **Dependencies:** `ledger`, `transfers`, `payments`, `bank_accounts`, `audit_log`, `notifications`.
- **Errors:** `PAYOUT_NOT_FOUND`, `PAYOUT_NOT_ELIGIBLE`, `PAYOUT_ALREADY_PAID`, `PAYOUT_CANCELLED`, `INSUFFICIENT_AVAILABLE_FUNDS`, `RECIPIENT_UNVERIFIED`.
