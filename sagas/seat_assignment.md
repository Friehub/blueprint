# Saga: `seat_assignment`

**Version:** 0.1.0

**Modules:** seat_management → users → tenants → notifications

---

## Steps

1. **validate_seat_availability(tenant_id, plan_tier)** -- Check tenant has an unassigned seat available on their plan.
   **Compensation:** none (read-only; seat count is idempotent)

2. **reserve_seat(tenant_id, user_id)** → `SeatReservation`
   **Compensation:** `seat_management.releaseSeat(reservation_id)` -- frees the reserved seat

3. **invite_user(tenant_id, email, role)** → `Invitation`
   **Compensation:** `users.revokeInvitation(invitation_id)` -- cancels the pending invitation

4. **assign_seat(user_id, tenant_id, role)** -- Link user to tenant with assigned role
   **Compensation:** `seat_management.unassignSeat(user_id, tenant_id)` -- removes the assignment

5. **[async] notify_user(email, tenant_name, role)** -- Send invitation email with onboarding link
   **Compensation:** none (informational; retry on failure)

6. **[async] notify_tenant_admin(tenant_id, user_id, assigned_by)** -- Alert admins of new seat assignment
   **Compensation:** none (informational; audit trail in seat_management)

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 1 | No available seats on current plan | Return `no_seats_available` error; upsell suggestion |
| 3 | Email delivery failure | Seat reserved but invitation pending; retry with backoff |
| 4 | Concurrent assignment conflict | Retry idempotently with optimistic locking |
| 5 | Notification delivery failure | Seat assigned; user visible in tenant roster without notification |

---

## Invariants

- A tenant must never exceed its plan's seat limit
- A user can be assigned to a tenant seat at most once (unique user_id + tenant_id)
- Every seat assignment or release must be logged for billing reconciliation
