## 9.1 Cross-Module Contracts (Sagas)

### What They Are

A cross-module contract defines the correct sequence of operations across multiple modules, the compensation logic that must execute when any step fails, and which module owns each rollback. This is the formal specification of the saga pattern.

In every real enterprise system, the hard bugs are not inside modules. They are in the seams between them. `createOrder` touches `inventory`, `payments`, and `notifications` in sequence. Any step can fail after previous steps have committed. Without a specified saga, every implementer invents their own compensation logic differently, and the system accumulates silent inconsistencies.

### Specification Format

```
saga <name>
  version <semver>
  steps:
    <n>. <module>.<function>(args) → <result>
         on_failure: <compensation>
  invariant: <what must hold across all steps at all times>
  timeout: <maximum duration for the entire saga>
```

### Worked Examples

---

**Saga: `place_order`**

Triggered by: `orders.createOrder`

```
saga place_order
  version 1.0

  steps:
    1. inventory.reserveStock(variant_id, quantity, order_id) → ReservationToken
       on_failure: abort — no compensation needed, nothing committed

    2. payments.initiatePayment(order_id, amount, currency, method) → Payment
       on_failure: inventory.releaseStock(reservation_token)

    3. orders.transitionOrderStatus(order_id, "confirmed") → Order
       on_failure: payments.initiateRefund(payment_id, "order_confirmation_failed")
                   inventory.releaseStock(reservation_token)

    4. notifications.sendEmail(user_id, "order_confirmed", variables) → DeliveryResult
       on_failure: log and continue — notification failure must not reverse a confirmed order

  invariant: at no point may payment be completed and stock unreserved
             at no point may order be confirmed and payment not completed
  timeout: 30 seconds
```

---

**Saga: `process_refund`**

Triggered by: `orders.approveReturn`

```
saga process_refund
  version 1.0

  steps:
    1. orders.transitionOrderStatus(order_id, "returned") → Order
       on_failure: abort

    2. inventory.updateStockOnHand(variant_id, +quantity, location_id) → void
       on_failure: orders.transitionOrderStatus(order_id, "return_failed")
                   — alert operations team

    3. payments.initiateRefund(payment_id, amount, "return_approved") → Refund
       on_failure: inventory.adjustStock(variant_id, -quantity, "refund_failed_reversal")
                   orders.transitionOrderStatus(order_id, "refund_failed")

    4. notifications.sendEmail(user_id, "refund_initiated", variables) → DeliveryResult
       on_failure: log and continue

  invariant: stock must not be restocked without a corresponding refund being initiated
  timeout: 60 seconds
```

---

**Saga: `cancel_subscription`**

Triggered by: `billing.cancelSubscription`

```
saga cancel_subscription
  version 1.0

  steps:
    1. billing.cancelSubscription(user_id, at_period_end: true) → Subscription
       on_failure: abort

    2. feature_flags.setFlag("premium_features_" + user_id, false) → Flag
       on_failure: billing.reactivateSubscription(user_id)

    3. subscriptions.revokeEntitlement(user_id, "premium") → void
       on_failure: billing.reactivateSubscription(user_id)
                   feature_flags.setFlag("premium_features_" + user_id, true)

    4. notifications.sendEmail(user_id, "subscription_cancelled", variables) → DeliveryResult
       on_failure: log and continue

    5. audit_log.recordEvent({ actor, action: "subscription.cancelled", resource: user_id }) → void
       on_failure: log and continue — audit failure must not reverse cancellation

  invariant: entitlement must not be active when subscription is cancelled
  timeout: 15 seconds
```

---

### Cross-Module Contract Rules

**Rule 1 — Compensation is required for every step with external side effects.**
A step has external side effects if it mutates state in any module. Notification delivery is an exception — it must never block or reverse business operations.

**Rule 2 — Compensation must be idempotent.**
`releaseStock`, `initiateRefund`, and all other compensation operations will be called at least once. They must handle duplicate calls without producing incorrect state.

**Rule 3 — The saga orchestrator must be the single source of truth.**
No individual module knows it is part of a saga. The orchestrating service holds the saga state. If the orchestrator crashes, the saga must be resumable from the last committed step.

**Rule 4 — Notification failures never reverse business operations.**
Email, SMS, and push delivery failures are operational concerns, not domain failures. A confirmed order remains confirmed even if the confirmation email fails.

---
