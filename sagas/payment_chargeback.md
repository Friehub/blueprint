# Saga: `payment_chargeback`

**Version:** 0.1.0

**Modules:** payments → chargebacks → disputes → ledger → notifications → audit_log → fraud_detection

---

## Steps

1. **receive_chargeback(transaction_id, reason, amount)** → `Chargeback`
   **Compensation:** none (external event — cannot undo)

2. **open_dispute(chargeback_id, transaction_id)** → `Dispute`
   **Compensation:** `disputes.closeDispute(dispute_id)` — marks as closed

3. **hold_funds(transaction_id, amount)** -- Freeze disputed amount in ledger
   **Compensation:** `ledger.releaseHold(transaction_id)` — releases held funds

4. **collect_evidence(dispute_id, evidence[])** -- Gather transaction logs, receipts, comms
   **Compensation:** none (append-only; irrelevant evidence can be marked)

5. **submit_evidence(dispute_id, evidence_package)** -- Submit to payment processor
   **Compensation:** none (submission cannot be retracted; rely on processor retry)

6. **record_decision(dispute_id, outcome)** → `Won | Lost`
   **Compensation:** none (final — compensating transaction posted in next step)

7. **settle_outcome(dispute_id, outcome)**:
   - If WON: release hold, return funds to merchant
   - If LOST: finalize debit, post loss to ledger
   **Compensation:** `ledger.postTransaction(reference: "chargeback_settlement_reversal")` if erroneous

8. **[async] notify_stakeholders(dispute_id, outcome)** -- Email merchant + log audit
   **Compensation:** async, non-blocking

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 3 | Ledger hold fails due to insufficient balance | Flag for manual review; alert finance team |
| 5 | Evidence submission rejects (deadline passed) | Auto-accept dispute as lost; alert merchant |
| 7 | Settlement write fails | Retry with idempotency; escalate if persistent |
