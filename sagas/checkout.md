# Saga: `checkout`

**Version:** 0.1.0

**Modules:** cart → orders → payments → inventory → notifications → fulfillment → audit_log

---

## Steps

1. **validate_cart(cart_id)** -- Verify items still available at quoted prices. Lock cart contents.
   **Compensation:** none (read-only, cart lock expires automatically)

2. **create_order(cart_id, user_id, address)** → `Order`
   **Compensation:** `orders.cancelOrder(order_id, reason: "checkout_failed")`

3. **reserve_inventory(order_id, items[])** → `ReservationId`
   **Compensation:** `inventory.releaseStock(reservation_token)` -- releases reserved quantity

4. **initiate_payment(order_id, amount, method, idempotency_key)** → `Payment`
   **Compensation:** `payments.initiateRefund(payment_id, amount, reason: "checkout_failed")`

5. **confirm_order(order_id)** → `Order`
   **Compensation:** none (idempotent -- confirm twice is safe)

6. **[async] confirm_inventory(reservation_token)** -- Finalize stock deduction
   **Compensation:** handled by order cancel if needed

7. **[async] emit_events** -- OrderConfirmed → triggers fulfillment, notification, audit_log in parallel
   **Compensation:** async, non-blocking -- handled by event bus retry

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 3 | Out of stock | Cancel order (step 2), return `item_unavailable` error |
| 4 | Card declined | Release inventory (step 3), cancel order (step 2), return `payment_failed` error |
| 4 | Provider timeout | Retry with same idempotency key; do NOT create new payment |
| 5 | DB write failure after payment | Payment captured, order unconfirmed -- retry idempotently |
| 6 | Event bus unavailable | Events queued in outbox; no compensation needed |

---

## Invariants

- Payment must never be captured without a corresponding order record
- Inventory must never be deducted for a failed or uncaptured payment
- Saga orchestrator holds the idempotency key -- not individual steps
- Partial completion must be recoverable via idempotent retry
