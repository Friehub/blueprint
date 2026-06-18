# Saga: `payout_disbursement`

**Version:** 0.1.0

**Modules:** ledger → payouts → bank_accounts → notifications → audit_log

---

## Steps

1. **validate_payout(payout_id, merchant_id)** -- Verify payout is approved, funds are available, and bank account is active.
   **Compensation:** none (read-only, idempotent)

2. **reserve_funds(ledger_account_id, amount)** → `LedgerHoldReference`
   **Compensation:** `ledger.releaseHold(hold_reference)` -- releases the reserved funds

3. **submit_ach_transaction(payout_id, bank_account_id, amount)** → `TransactionReference`
   **Compensation:** `payouts.cancelTransaction(transaction_reference)` -- cancels ACH if not yet settled

4. **debit_ledger(hold_reference, transaction_reference)** -- Finalize ledger deduction against completed payout
   **Compensation:** `ledger.creditAccount(ledger_account_id, amount)` -- reverses the debit

5. **[async] notify_merchant(merchant_id, payout_id, status)** -- Send payout confirmation
   **Compensation:** none (informational; retry on failure)

6. **[async] record_audit_event(payout_id, action, actor)** -- Log the full disbursement trail
   **Compensation:** none (audit is append-only; retry on failure)

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 1 | Payout already processed or cancelled | Return `invalid_state` error; no state change |
| 3 | ACH submission rejected by bank | Release hold; retry with updated bank info |
| 4 | Ledger write failure after ACH sent | Manual reconciliation required; atomically track in dead-letter queue |
| 5 | Notification delivery failure | Queue for retry; payout status visible in dashboard |

---

## Invariants

- A payout must never be disbursed twice (idempotency key per payout_id)
- Funds must be reserved before any external transfer is initiated
- Every payout state transition must be recorded in the audit log
