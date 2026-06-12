# Saga: `refund`

**Version:** 0.1.0

**Modules:** orders → payments → inventory → notifications → ledger

---

## Steps

1. **validate_refund(order_id, amount, reason)** -- Verify refund is within policy window and amount
   **Compensation:** none (read-only)

2. **create_refund_record(order_id, amount, reason)** → `RefundRecord`
   **Compensation:** none (record is idempotent)

3. **initiate_refund(payment_id, amount, reason, idempotency_key)** → `Refund`
   **Compensation:** If provider rejects, mark refund record as failed (no rollback needed)

4. **restore_inventory(order_id, items[])** -- Return items to available stock if physical goods
   **Compensation:** none (restocking is idempotent)

5. **update_order_status(order_id, status: "returned")** -- If full refund
   **Compensation:** none (idempotent)

6. **[async] notify_user(order_id, refund_amount, method)** -- Inform user of completed refund
   **Compensation:** async, non-blocking

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 3 | Provider rejects refund | Mark refund as failed, notify operator for manual review |
| 3 | Provider timeout | Retry with same idempotency key |
| 4 | Inventory service down | Queue inventory restoration, continue saga |

---

## Invariants

- A refund must never exceed the original payment amount
- Provider refund must complete before inventory is restored
- Partial refunds must restore inventory proportionally
