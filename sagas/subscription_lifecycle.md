# Saga: `subscription_lifecycle`

**Version:** 0.1.0

**Modules:** billing → payments → subscriptions → notifications → audit_log

---

## Steps -- Create Subscription

1. **validate_payment_method(user_id, payment_method)** -- Check method is chargeable
   **Compensation:** none (read-only)

2. **create_subscription(user_id, plan_id, payment_method, idempotency_key)** → `Subscription`
   **Compensation:** `billing.cancelSubscription(subscription_id, at_period_end: false)` -- immediate cancel

3. **create_invoice(subscription_id, plan, period)** → `Invoice`
   **Compensation:** void invoice if subscription creation fails upstream

4. **charge_invoice(invoice_id, payment_method, idempotency_key)** → `Payment`
   **Compensation:** mark invoice as failed, set subscription to past_due

5. **[async] grant_entitlements(user_id, plan)** -- Provision access
   **Compensation:** async -- if fails, subscription still active but entitlements degraded

---

## Steps -- Cancel Subscription

1. **schedule_cancellation(subscription_id, at_period_end)** → `Subscription`
   **Compensation:** `billing.reactivateSubscription(subscription_id)` -- undo if within grace period

2. **at_period_end: revoke_entitlements(user_id, plan)** → Remove access
   **Compensation:** restore entitlements if payment received before grace expiry

3. **[async] final_invoice(subscription_id)** -- Generate final invoice for usage if applicable
   **Compensation:** void final invoice if reactivation occurs

---

## Steps -- Upgrade / Downgrade

1. **validate_upgrade(subscription_id, new_plan_id)** -- Check eligibility
   **Compensation:** none (read-only)

2. **prorate(subscription_id, new_plan_id)** -- Calculate prorated charge/credit
   **Compensation:** none (calculation is deterministic)

3. **collect_proration(subscription_id, amount, idempotency_key)** → `Payment`
   **Compensation:** void upgrade, keep current plan

4. **update_subscription_plan(subscription_id, new_plan_id, effective_date)** → `Subscription`
   **Compensation:** revert to previous plan (idempotent)

5. **[async] adjust_entitlements(user_id, new_plan)** -- Update access
   **Compensation:** async, non-blocking

---

## Failure Modes

| Phase | Failure | Compensation |
|---|---|---|
| Create step 4 | Payment declined | Subscription created but past_due; retry payment |
| Cancel step 2 | Entitlement revocation fails | Retry; subscription still cancelled, access may lag |
| Upgrade step 3 | Proration payment fails | Abort upgrade, keep current plan active |

---

## Invariants

- A user must never be double-charged for the same period
- Entitlements must match the current plan within eventual consistency bounds
- Cancellation at_period_end must preserve access until the period end
