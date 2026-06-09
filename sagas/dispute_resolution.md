# Saga: `dispute_resolution`

**Version:** 0.1.0

**Modules:** payments → disputes → notifications → audit_log → chargebacks → fraud_detection

---

## Steps

1. **receive_dispute(payment_id, dispute_data)** → `Dispute`
   **Compensation:** none — dispute received from external source, cannot be undone

2. **freeze_funds(payment_id)** — Lock disputed amount in wallet or ledger
   **Compensation:** `payments.releaseFunds(payment_id)` — release if dispute resolved in merchant's favor

3. **gather_evidence(dispute_id)** — Collect transaction logs, communication, delivery proof
   **Compensation:** none (evidence collection is additive)

4. **submit_evidence(dispute_id, evidence, deadline)** → `SubmissionResult`
   **Compensation:** none — submission is final; missed deadline cannot be recovered

5. **await_outcome(dispute_id)** → `DisputeOutcome` (won | lost | partial)
   **Compensation:** none — outcome is final

6. **on_lost: reverse_funds(payment_id, amount)** — Deduct disputed amount
   **Compensation:** if outcome later overturned, re-credit funds

7. **on_won: release_funds(payment_id)** — Release frozen funds back to merchant
   **Compensation:** none

8. **[async] update_fraud_models(dispute_id, outcome)** → Feed back to fraud detection
   **Compensation:** async, non-blocking

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 3 | Evidence source unavailable | Note gap in evidence, submit what is available |
| 4 | Deadline missed | Automatic loss; notify finance team |
| 6 | Ledger update fails | Retry; funds frozen until resolution |

---

## Invariants

- Disputed funds must remain frozen until the dispute is resolved
- Evidence must be timestamped and immutable once submitted
- The merchant must be notified at every state transition
- Outcome must be recorded in audit_log regardless of win/loss
