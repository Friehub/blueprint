# Saga: `plan_upgrade_downgrade`

**Version:** 0.1.0

**Modules:** billing → subscriptions → seat_management → notifications

---

## Steps

1. **validate_new_plan(tenant_id, target_plan_id)** -- Check plan exists, is compatible, respects limits
   **Compensation:** none (read-only, no side effects)

2. **calculate_proration(tenant_id, current_plan_id, target_plan_id)** → `Proration`
   **Compensation:** none (read-only calculation)

3. **update_subscription(tenant_id, target_plan_id, proration)** -- Switch plan, apply credits/debits
   **Compensation:** `subscriptions.revertPlan(tenant_id, current_plan_id)` -- restores previous plan

4. **adjust_seats(tenant_id, target_plan_id, current_seats)** -- Add or remove seat allocation as needed
   **Compensation:** `seat_management.restoreSeatCount(tenant_id, previous_seats)` -- reverts seat allocation

5. **issue_invoice(tenant_id, proration)** → `Invoice`
   **Compensation:** `billing.voidInvoice(invoice_id)` -- voids unposted invoice

6. **[async] notify_plan_change(tenant_id, target_plan_id, invoice_id)** -- Send plan change confirmation
   **Compensation:** none (informational; retry on failure)

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 3 | Payment method declined on upgrade | Revert plan, return `payment_failed` error |
| 4 | Seat reduction exceeds active users | Revert plan (step 3), return `seat_limit_exceeded` error |
| 5 | Invoice generation failure | Retry idempotently; subscription already updated |
| 6 | Notification failure | Log and retry via webhook outbox |

---

## Invariants

- A downgrade must never reduce allocated seats below current active user count
- Proration credits from a downgrade must be applied immediately or stored as account credit
- An invoice must always reference the correct proration period and effective dates
