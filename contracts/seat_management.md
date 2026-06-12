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
- Seat counts must never exceed the configured limit unless overage is explicitly allowed. The database must enforce `assigned <= limit + COALESCE(overage_allowed, 0)` via a CHECK constraint or application-level atomic check
- A user can hold at most one active seat of the same seat type per account -- enforced via UNIQUE constraint on `(account_id, user_id, seat_type)` WHERE status = 'active'
- Released seats must become available immediately after durable commit -- the seat count decrement and availability update must be in the same transaction
- `transferSeat` must atomically release the from-user seat and assign the to-user seat in a single transaction; a partial transfer (release without reassign) is never permitted
- `setSeatLimit` must not reduce the limit below the currently assigned count unless overage is explicitly allowed -- if assigned > new limit and overage_allowed is false, the operation must be rejected

**Providers:** internal SaaS account stores, enterprise licensing systems, custom database-backed seat allocators

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Seat assignment and release must be strongly consistent. Concurrent assignment requests for the same account must be serialised to prevent overallocation.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for seat lifecycle events.
* **Details:** Duplicate assignment events must be idempotent (no-op on already-assigned seat). Duplicate release events on an already-released seat must be a no-op.

### Worker Scaling
* **Policy:** Seat assignment and release must be synchronous and strongly consistent; they cannot be scaled horizontally for the same account without a distributed lock. Policy queries (getSeatUsage, listSeats) may be served from read replicas.

### Multi-Region Behavior
* **Mode:** Seat state is single-region for write consistency. Multi-region deployments must use a single write region with read replicas in other regions; seat limits and usage data may be stale by up to 5 seconds on reads.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Required Functions:**
  - `assignSeat(account_id, user_id, seat_type?, idempotency_key?)`
  - `releaseSeat(account_id, user_id, idempotency_key?)`
  - `transferSeat(account_id, from_user_id, to_user_id, idempotency_key?)`
  - `setSeatLimit(account_id, seat_type, limit, idempotency_key?)`

### Backpressure
* If seat assignment contention is high, the module must queue and retry rather than returning a transient error. `assignSeat` against a fully utilised account must return a clear `SEAT_LIMIT_EXCEEDED` error, not a timeout.

### Algorithm
* **Recommended:** Pessimistic locking (SELECT FOR UPDATE) on the account's seat policy row during assignment and release to prevent race conditions. Optimistic concurrency with retry for low-contention accounts.
* **Atomicity:** Seat assignment must atomically check the limit and insert the assignment in a single operation. A two-phase check-then-insert without locking is a contract violation.

### Storage Model
* **Model:** Relational database (PostgreSQL) for seat assignments and policies.
* **Details:**
```sql
CREATE TABLE seat_policies (
    account_id      UUID NOT NULL,
    seat_type       TEXT NOT NULL,
    seat_limit      INT NOT NULL CHECK (seat_limit > 0),
    overage_allowed BOOLEAN NOT NULL DEFAULT false,
    effective_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, seat_type)
);

CREATE TABLE seat_assignments (
    id              UUID PRIMARY KEY,
    account_id      UUID NOT NULL,
    user_id         UUID NOT NULL,
    seat_type       TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'released', 'transferred')),
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    released_at     TIMESTAMPTZ,
    UNIQUE (account_id, user_id, seat_type) WHERE status = 'active'
);

CREATE INDEX idx_seat_assignments_account ON seat_assignments (account_id, seat_type, status);
```

### Error Taxonomy
### Module-Specific Errors
```
assignSeat:
    seat_limit_exceeded:      Account has reached its seat limit | upgrade plan or release seats
    seat_already_assigned:    User already holds an active seat of this type | return existing assignment
    invalid_seat_type:        Seat type is not configured for this account | check available seat types

  releaseSeat:
    seat_not_found:           No active seat found for this user+account | no-op (idempotent)

  transferSeat:
    source_not_found:         Source user has no active seat to transfer | verify source user
    target_already_assigned:  Target user already holds an active seat of this type | release target seat first

  setSeatLimit:
    limit_too_low:            New limit is below current assigned count and overage not allowed | release seats first or enable overage

  getSeatPolicy:
    account_not_found:        Account has no seat policy configured | set a policy first
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
assignSeat        → seat.assigned                 { assignment_id, account_id, user_id, seat_type }
releaseSeat       → seat.released                 { account_id, user_id, seat_type }
transferSeat      → seat.transferred              { account_id, from_user_id, to_user_id, seat_type }
setSeatLimit      → seat.limit_changed            { account_id, seat_type, old_limit, new_limit }
```

### Temporal Constraints
```
Seat assignment:
    duration:       active until explicitly released or transferred
    on_expiry:      N/A -- no automatic expiry

  Seat policy change:
    effective:      immediately upon commit
    on_change:      emit seat.limit_changed event; recalculate seat usage counts
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `seat_management.<function>`.
* **Telemetry Metrics:**
```
blueprint_seat_management_assigned_total           gauge { account_id, seat_type }
blueprint_seat_management_limit_total              gauge { account_id, seat_type }
blueprint_seat_management_operations_total         counter { function, result }
blueprint_seat_management_operation_duration_ms     histogram { function }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details). Seat assignment P99 must be < 100ms.

### Module Dependencies
* **Depends On:** tenants, users, billing
* **Emits To:** events
* **Recommends:** audit_log, notifications
