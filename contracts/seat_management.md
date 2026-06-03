# Module Contract: `seat_management`

**Version:** 0.1.0

---

### `seat_management`
Licensing seat allocation, assignment, transfer, and release for SaaS accounts.

**Functions**
```
assignSeat(account_id, user_id, seat_type?) → SeatAssignment
releaseSeat(account_id, user_id) → void
transferSeat(account_id, from_user_id, to_user_id) → SeatAssignment
listSeats(account_id, options?) → PaginatedResult<SeatAssignment>
getSeatUsage(account_id) → SeatUsage
setSeatLimit(account_id, seat_type, limit) → SeatPolicy
getSeatPolicy(account_id) → SeatPolicy
```

**Types**
```
SeatAssignment { id, account_id, user_id, seat_type, status, assigned_at, released_at? }
SeatUsage { account_id, assigned, available, limit, overage }
SeatPolicy { account_id, seat_type, limit, overage_allowed, effective_at }
SeatType = licensed | admin | viewer | custom
SeatStatus = active | released | transferred
```

**Invariants**
- Seat counts must never exceed the configured limit unless overage is explicitly allowed.
- A user can hold at most one active seat of the same seat type per account.
- Released seats must become available immediately after durable commit.

**Providers:** internal SaaS account stores, enterprise licensing systems, custom database-backed seat allocators

---

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Seat assignment and release must be strongly consistent.
- **Idempotency:** `assignSeat`, `releaseSeat`, and `transferSeat` must be idempotent on the account-user-seat tuple.
- **Storage Model:** Durable seat ledger and assignment history.
- **Dependencies:** `tenants`, `users`, `billing`, `audit_log`, `notifications`.
- **Errors:** `SEAT_NOT_FOUND`, `SEAT_LIMIT_EXCEEDED`, `SEAT_ALREADY_ASSIGNED`, `SEAT_NOT_RELEASABLE`, `ACCOUNT_NOT_FOUND`.
