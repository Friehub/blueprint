# Module Contract: `payouts`

**Version:** 0.2.1

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

### Retry Policy

**Failed Payout Retry:**
- Automatic retries: 3 attempts total (initial + 2 retries)
- Backoff strategy: exponential with jitter — 2^attempt seconds (2s, 4s, 8s)
- Maximum retry window: 72 hours from first failure
- After exhaustion: transition to `failed`, move to dead-letter queue

**Manual Retry (`retryPayout`):**
- Can be triggered after automatic retries are exhausted
- Must be explicitly invoked by an operator or automated monitoring
- Resets the retry counter and applies the same retry policy
- Each manual retry is recorded in `audit_log` with operator identity

**Retry Conditions:**
| Failure Reason | Retry? | Notes |
|---|---|---|
| Network timeout | Yes | Transient; safe to retry |
| Provider rate limited | Yes | Respect Retry-After header |
| Recipient bank rejected | No | Requires operator intervention |
| Insufficient funds | No | Must be resolved at ledger level |
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

| Invalid recipient details | No | Requires recipient verification update |
