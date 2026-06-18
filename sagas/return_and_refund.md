# Saga: `return_and_refund`

**Version:** 0.1.0

**Modules:** returns → orders → inventory → payments

---

## Steps

1. **validate_return_request(return_id, order_id, user_id)** -- Check return window, order status, and item eligibility.
   **Compensation:** none (read-only; return window check is idempotent)

2. **create_return_authorization(return_id, items)** → `ReturnAuthorization`
   **Compensation:** `returns.voidAuthorization(return_id)` -- cancels the RMA

3. **receive_returned_items(return_id, condition_check)** → `ReturnReceipt`
   **Compensation:** `returns.reverseReceipt(return_id)` -- marks items as pending; triggers manual review

4. **restock_inventory(items, condition)** -- Return items to available inventory (or quarantine)
   **Compensation:** `inventory.reverseRestock(items)` -- pulls items back from available stock

5. **issue_refund(order_id, amount, payment_method)** → `RefundTransaction`
   **Compensation:** `payments.reverseRefund(refund_transaction_id)` -- reverses if refund not yet settled

6. **update_order_status(order_id, "refunded")** -- Mark order as fully refunded
   **Compensation:** none (idempotent; status write is final)

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 1 | Return window expired or order not delivered | Return `invalid_return` error; no state change |
| 3 | Item condition does not match claim | Flag for manual review; hold refund |
| 5 | Payment provider refund failure | Retry with alternative method; alert support |
| 6 | Order status update conflict | Retry idempotently; eventual consistency |

---

## Invariants

- A refund must never exceed the original order amount (net of non-refundable fees)
- Items must be physically received before inventory restock or refund issuance
- Each return line item can be refunded at most once
