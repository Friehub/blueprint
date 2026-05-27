# Knowledge Base: Fintech / Payments Domain
## Engineering Primitives Graph

> This document is the ground truth for the Engineering Blueprinting Platform
> when operating in the Fintech/Payments domain. Every design recommendation
> the engine produces must be traceable to a node in this graph.
> It is not documentation. It is a formal constraint set.

---

## How to Read This Document

Each **Node** is an engineering primitive — a pattern, strategy, or concept.
Each **Edge** is a relationship between primitives:

- `REQUIRES`: Using this node forces you to also implement the target node.
- `CONFLICTS_WITH`: Using both nodes simultaneously creates undefined behavior.
- `SOLVES`: This node was created specifically to resolve the target failure mode.
- `INTRODUCES`: Adopting this node creates the target new problem.
- `SUPERSEDED_BY`: This node is obsolete in the context of the target node.

---

## Part 1 — Failure Mode Register (Pre-Loaded Adversarial Scenarios)

These are the known failure modes the Adversarial Pass checks against for
every fintech system. They are ordered by likelihood × severity.

### FM-001 — Double Charge (CRITICAL)
**Description**: A payment is submitted. The response times out. The client
retries. The payment processor executes the charge twice.
**Conditions that trigger it**:
- No idempotency key on the payment request.
- The retry does not carry the original request identifier.
- The processor does not deduplicate on its side.
**Required mitigation**: Idempotency Key Pattern (see Node: IDEMPOTENCY_KEY).
**Formal invariant**:
`ASSERT: COUNT(charges WHERE request_id = X) <= 1 FOR ALL X`

### FM-002 — Stale Balance Read (CRITICAL)
**Description**: Two concurrent requests read the same balance. Both pass
the "sufficient funds" check. Both proceed to deduct. The final balance is
negative.
**Conditions that trigger it**:
- "Check-then-act" pattern without atomic locking.
- Read replica used for balance check, write to primary.
- Optimistic locking not implemented.
**Required mitigation**: Atomic Balance Update (see Node: ATOMIC_LEDGER_ENTRY).
**Formal invariant**:
`ASSERT: balance >= 0 AT ALL TIMES FOR ALL accounts`

### FM-003 — Partial Commit (CRITICAL)
**Description**: A transfer deducts from Account A. Before crediting Account
B, the service crashes. Account A is debited. Account B never receives funds.
Money is destroyed.
**Conditions that trigger it**:
- Two separate database writes without a transaction boundary.
- Event published before the database transaction commits.
- Saga not implemented with compensating transactions.
**Required mitigation**: Double-Entry Ledger Pattern (see Node: DOUBLE_ENTRY_LEDGER).
**Formal invariant**:
`ASSERT: SUM(all_ledger_entries) = 0 AT ALL TIMES`
(Every debit entry has a matching credit entry. Total system money is conserved.)

### FM-004 — Ghost Transaction (HIGH)
**Description**: A transaction record exists in the database, but no actual
money movement occurred (or vice versa). The books don't balance.
**Conditions that trigger it**:
- Writing transaction record and calling payment processor in separate,
  non-atomic operations.
- Processor succeeds but local write fails.
- Local write succeeds but processor call never happens.
**Required mitigation**: Outbox Pattern (see Node: OUTBOX_PATTERN).
**Formal invariant**:
`ASSERT: EVERY transaction_record HAS a corresponding processor_confirmation`

### FM-005 — Retry Storm (HIGH)
**Description**: A downstream service is slow. All clients start retrying
simultaneously. The increased load makes the service slower. Retries increase.
System enters a death spiral.
**Conditions that trigger it**:
- Fixed retry interval (not exponential backoff).
- No jitter on retry timing.
- No circuit breaker on the calling service.
**Required mitigation**: Exponential Backoff with Jitter + Circuit Breaker
(see Nodes: EXPONENTIAL_BACKOFF, CIRCUIT_BREAKER).

### FM-006 — Currency Precision Loss (HIGH)
**Description**: Floating-point arithmetic on monetary values causes rounding
errors. Over millions of transactions, the accumulated error is significant.
**Conditions that trigger it**:
- Using `float` or `double` for monetary amounts.
- Division operations on amounts without explicit rounding rules.
**Required mitigation**: Fixed-Point Arithmetic (see Node: MONETARY_PRECISION).
**Formal invariant**:
`ASSERT: ALL monetary_values ARE stored as INTEGER (minor units) OR DECIMAL(19,4)`

### FM-007 — Clock Skew in Settlement (MEDIUM)
**Description**: Two services use different system clocks. Timestamps on
transactions disagree. Settlement calculations for a "business day" are
inconsistent across services.
**Conditions that trigger it**:
- Services using local system time without NTP synchronization.
- Using wall clock time for business logic instead of logical clocks.
**Required mitigation**: Centralized timestamp authority or logical clocks
for sequencing (see Node: LOGICAL_CLOCK).

### FM-008 — Silent Authorization Expiry (MEDIUM)
**Description**: A payment is authorized but not captured. The authorization
expires (typically 7 days). The merchant attempts capture. It fails silently.
The order is processed but payment never collected.
**Conditions that trigger it**:
- No TTL tracking on authorization records.
- No background job monitoring authorization expiry.
- Capture assumed to always succeed.
**Required mitigation**: Authorization Lifecycle State Machine
(see Node: AUTH_CAPTURE_STATE_MACHINE).

### FM-009 — Webhook Replay Attack (MEDIUM)
**Description**: A payment processor sends a webhook confirming payment.
An attacker intercepts and replays the webhook. The system credits the account
a second time.
**Conditions that trigger it**:
- No webhook signature verification.
- No idempotency check on incoming webhooks.
- Webhook processing not behind an authenticated endpoint.
**Required mitigation**: Webhook Signature Verification + Idempotent
Webhook Handler (see Nodes: WEBHOOK_IDEMPOTENCY, HMAC_VERIFICATION).

### FM-010 — Regulatory Window Violation (MEDIUM)
**Description**: A transaction is processed that violates a regulatory rule
(e.g., AML threshold, transaction velocity limit). No real-time check was
performed.
**Conditions that trigger it**:
- Compliance checks run asynchronously after transaction completes.
- Velocity limits calculated on stale data.
- No real-time screening against sanctions lists.
**Required mitigation**: Pre-Authorization Compliance Gate
(see Node: COMPLIANCE_GATE).

---

## Part 2 — Engineering Primitives (The Nodes)

### Node: IDEMPOTENCY_KEY
**Category**: Reliability Pattern
**Definition**: A unique, client-generated identifier attached to every
mutating request. The server uses it to detect and deduplicate retries.
**When required**: Any operation that triggers a payment charge, transfer,
or ledger entry.
**Implementation contract**:
- Key format: UUID v4 or ULID (time-ordered for index performance).
- Storage: Persisted in a dedicated `idempotency_keys` table with the
  request hash, response, and expiry timestamp.
- TTL: Keys expire after 24 hours (configurable per operation type).
- Behavior: On duplicate key, return the cached original response. Do NOT
  re-execute the operation.

**SOLVES**: FM-001 (Double Charge)
**REQUIRES**: IDEMPOTENCY_STORE
**INTRODUCES**: Key storage management, key expiry policy

---

### Node: IDEMPOTENCY_STORE
**Category**: Infrastructure Primitive
**Definition**: A persistent store for idempotency keys that supports
atomic "check-and-set" semantics.
**Implementation options**:
- **PostgreSQL** (recommended): Use `INSERT ... ON CONFLICT DO NOTHING`
  with a UNIQUE constraint on the key. Atomic by default.
- **Redis**: Use `SET key value NX EX ttl`. Atomic. Risk: eviction under
  memory pressure can cause key loss, re-enabling duplicate execution.
  Not recommended for critical payment idempotency.
**CONFLICTS_WITH**: Redis-only idempotency for critical payment paths
(eviction risk).

---

### Node: ATOMIC_LEDGER_ENTRY
**Category**: Concurrency Primitive
**Definition**: A balance update that uses database-level atomicity to
prevent concurrent over-spending.
**Implementation options (ordered by strength)**:

1. **SELECT FOR UPDATE (Pessimistic Locking)**:
   ```sql
   BEGIN;
   SELECT balance FROM accounts WHERE id = $1 FOR UPDATE;
   -- Check balance >= amount
   UPDATE accounts SET balance = balance - $amount WHERE id = $1;
   INSERT INTO ledger_entries ...;
   COMMIT;
   ```
   Locks the row for the duration of the transaction.
   **Risk**: Deadlock if two transactions lock rows in different orders.
   **Mitigation**: Always lock accounts in consistent ID order (lowest ID first).

2. **Optimistic Locking with Version Number**:
   ```sql
   UPDATE accounts SET balance = balance - $amount, version = version + 1
   WHERE id = $1 AND version = $expected_version AND balance >= $amount;
   -- Check rows_affected = 1, else retry
   ```
   No lock held. Retry on conflict.
   **Risk**: High retry rate under heavy contention (flash sale style payments).
   **Mitigation**: Add jitter to retries. Cap at 3 attempts then fail.

3. **Database Serializable Transactions** (Postgres SSI):
   Full isolation without explicit locks. Postgres detects and aborts
   conflicting transactions automatically.
   **Risk**: Higher abort rate under high concurrency. Requires retry logic.

**SOLVES**: FM-002 (Stale Balance Read)
**REQUIRES**: RETRY_WITH_JITTER (for optimistic locking path)
**CONFLICTS_WITH**: Read replica for balance checks on the same code path

---

### Node: DOUBLE_ENTRY_LEDGER
**Category**: Data Pattern
**Definition**: Every financial movement is recorded as two ledger entries:
a debit and a credit. The sum of all entries is always zero.
**Schema**:
```sql
CREATE TABLE ledger_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL REFERENCES accounts(id),
  amount      BIGINT NOT NULL, -- Always in minor units (cents/kobo)
  direction   CHAR(1) NOT NULL CHECK (direction IN ('D', 'C')),
  currency    CHAR(3) NOT NULL,
  reference   UUID NOT NULL,   -- Links debit and credit entries
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON ledger_entries (account_id, created_at);
CREATE INDEX ON ledger_entries (reference);
```
**Invariant enforcement**:
A database trigger or application-level assertion verifies that for every
`reference`, the sum of debit amounts equals the sum of credit amounts.
**SOLVES**: FM-003 (Partial Commit), FM-004 (Ghost Transaction)
**REQUIRES**: MONETARY_PRECISION (amounts stored as BIGINT minor units)
**INTRODUCES**: Balance requires aggregation (SUM of ledger) not a single column.
Must materialize balance via a view or cache with careful invalidation.

---

### Node: OUTBOX_PATTERN
**Category**: Reliability Pattern
**Definition**: Instead of publishing events directly to a message broker,
write the event to an `outbox` table in the same database transaction as
the business operation. A separate process reads the outbox and publishes to
the broker, deleting the row on success.
**Guarantees**: At-least-once delivery. The event is published if and only
if the business transaction commits.
**Implementation**:
```sql
-- In the same transaction as the ledger entry:
INSERT INTO outbox (id, event_type, payload, created_at)
VALUES (gen_random_uuid(), 'payment.completed', $payload, now());
```
A **relay process** (separate service or cron) polls the outbox and publishes
to Kafka/RabbitMQ/etc., then deletes the row.
**SOLVES**: FM-004 (Ghost Transaction)
**INTRODUCES**: Event delivery is now asynchronous. Consumers must handle
eventual consistency. Consumers MUST be idempotent (they may receive the
same event more than once).
**REQUIRES**: IDEMPOTENT_CONSUMER on the receiving side

---

### Node: SAGA_PATTERN
**Category**: Distributed Transaction Pattern
**Definition**: A sequence of local transactions where each step publishes
an event to trigger the next. If any step fails, compensating transactions
are executed in reverse order to undo completed steps.
**When required**: Any operation that spans multiple services and requires
atomicity (e.g., payment + inventory reservation + order creation).
**Two implementations**:
1. **Choreography**: Each service listens for events and publishes its own.
   No central coordinator. Lower coupling. Harder to debug.
2. **Orchestration**: A central "saga orchestrator" service manages the
   workflow and explicitly calls each service.
   Higher coupling. Easier to monitor and debug. Recommended for payment flows.
**SOLVES**: FM-003 (Partial Commit) in distributed contexts
**REQUIRES**: COMPENSATING_TRANSACTION for every step
**INTRODUCES**: Compensating transactions are NOT rollbacks. The system
temporarily enters an inconsistent state while compensation runs. This window
must be accounted for in the UI (e.g., "Payment processing..." state).
**CONFLICTS_WITH**: 2PC (Two-Phase Commit) — do not mix Saga and 2PC for
the same flow. Pick one.

---

### Node: COMPENSATING_TRANSACTION
**Category**: Reliability Pattern
**Definition**: A transaction that semantically undoes a previously committed
transaction. It does NOT use database ROLLBACK. It is a forward-moving
correction.
**Rule**: Every Saga step MUST have a defined compensating transaction before
the step is implemented. If you cannot define the compensation, the step
cannot be part of a Saga. Redesign the step.
**Example**:
- Step: Deduct $100 from user wallet.
- Compensation: Credit $100 to user wallet with reason code `SAGA_ROLLBACK`.
**REQUIRES**: IDEMPOTENCY_KEY (compensation may be retried)
**INTRODUCES**: Compensation audit trail (every compensation must be logged
with the original transaction reference).

---

### Node: MONETARY_PRECISION
**Category**: Data Primitive
**Definition**: All monetary values are stored and calculated in **integer
minor units** (e.g., cents, pence, kobo). Display conversion happens only
at the presentation layer.
**Rule**: `amount_displayed = amount_stored / 10^decimal_places`
**NEVER**: Store amounts as `FLOAT` or `DOUBLE`.
**Preferred storage type**: `BIGINT` (for amounts up to 9.2 quadrillion minor
units) or `DECIMAL(19, 4)` for currencies requiring fractional minor units.
**SOLVES**: FM-006 (Currency Precision Loss)
**REQUIRES**: Explicit rounding rule definition per currency
(USD rounds to 2 decimal places, JPY rounds to 0, etc.)

---

### Node: CIRCUIT_BREAKER
**Category**: Resilience Pattern
**Definition**: A state machine that wraps calls to external services. After
N consecutive failures, the breaker "opens" and immediately rejects calls
for a cooldown period. After the cooldown, it enters "half-open" state,
allowing one test request.
**States**: CLOSED (normal) → OPEN (failing) → HALF-OPEN (testing) → CLOSED
**Thresholds**: Define per downstream service:
- `failure_threshold`: Number of consecutive failures to open the breaker.
- `timeout`: Duration the breaker stays open.
- `success_threshold`: Successes in half-open state to close the breaker.
**SOLVES**: FM-005 (Retry Storm) — prevents cascading failures
**REQUIRES**: EXPONENTIAL_BACKOFF (for the retry path when breaker is closed)
**INTRODUCES**: Fallback behavior must be defined. What does the system do
when the circuit is open? Options: Return cached response, queue the request,
return a user-friendly error.

---

### Node: EXPONENTIAL_BACKOFF
**Category**: Resilience Primitive
**Definition**: Retry delays that grow exponentially with each attempt,
plus a random jitter to prevent synchronized retries across clients.
**Formula**: `delay = min(cap, base * 2^attempt) + random(0, jitter_max)`
**Recommended defaults for payment flows**:
- `base`: 100ms
- `cap`: 30 seconds
- `jitter_max`: 25% of calculated delay
- `max_attempts`: 3 for user-facing flows, 10 for background jobs
**SOLVES**: FM-005 (Retry Storm) — jitter prevents synchronized retry waves
**REQUIRES**: IDEMPOTENCY_KEY on the retried request

---

### Node: AUTH_CAPTURE_STATE_MACHINE
**Category**: State Machine Pattern
**Definition**: An explicit state machine for the payment authorization
lifecycle to prevent invalid state transitions.
**States**:
```
INITIATED → AUTHORIZED → CAPTURED → SETTLED
                       ↓
                    VOIDED
INITIATED → FAILED
AUTHORIZED → EXPIRED (after TTL with no capture)
```
**Rules**:
- `CAPTURE` is only valid from `AUTHORIZED` state.
- `VOID` is only valid from `AUTHORIZED` state.
- `EXPIRED` is set by a scheduled job monitoring TTLs.
- No direct transition from `INITIATED` to `CAPTURED`.
**SOLVES**: FM-008 (Silent Authorization Expiry)
**REQUIRES**: Background job for expiry monitoring (EXPIRY_MONITOR)
**INTRODUCES**: State transition audit log. Every state change must be
recorded with timestamp, actor, and reason.

---

### Node: COMPLIANCE_GATE
**Category**: Pre-Authorization Control
**Definition**: A synchronous check executed before any payment is authorized.
It evaluates the transaction against configured rules and blocks if violated.
**Checks in gate (ordered by cost — cheapest first)**:
1. Amount limits (per transaction, daily, monthly).
2. Velocity checks (N transactions in T minutes from same account/IP).
3. Duplicate detection (same amount + merchant within 60 seconds).
4. Sanctions screening (async for MVP, sync for production).
**SOLVES**: FM-010 (Regulatory Window Violation)
**INTRODUCES**: Gate adds latency to payment path. Target: < 50ms for
synchronous checks. Async checks must not block payment authorization.
**CONFLICTS_WITH**: Async-only compliance. Compliance must be synchronous
for hard blocks. Async is only acceptable for informational flags.

---

### Node: WEBHOOK_IDEMPOTENCY
**Category**: Integration Pattern
**Definition**: Incoming webhooks from payment processors are deduplicated
using the processor's event ID before processing.
**Implementation**:
```sql
CREATE TABLE processed_webhooks (
  provider_event_id VARCHAR(255) PRIMARY KEY,
  processed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- On webhook receipt:
INSERT INTO processed_webhooks (provider_event_id)
VALUES ($1) ON CONFLICT DO NOTHING
RETURNING *;
-- If no row returned, this is a duplicate. Skip processing.
```
**SOLVES**: FM-009 (Webhook Replay Attack)
**REQUIRES**: HMAC_VERIFICATION (verify the webhook is genuine before
checking idempotency)

---

### Node: HMAC_VERIFICATION
**Category**: Security Primitive
**Definition**: Webhook payloads are signed by the payment processor using
HMAC-SHA256. The receiving service verifies the signature before processing.
**Implementation**:
```
expected_sig = HMAC-SHA256(webhook_secret, raw_request_body)
received_sig = request.headers['X-Signature']
ASSERT: constant_time_compare(expected_sig, received_sig)
```
**Critical**: Use `constant_time_compare`, not `==`. String equality
short-circuits and is vulnerable to timing attacks.
**SOLVES**: FM-009 (Webhook Replay Attack) — prevents spoofed webhooks
**REQUIRES**: Webhook secret stored in environment variable, never in code.

---

### Node: LOGICAL_CLOCK
**Category**: Distributed Systems Primitive
**Definition**: A sequence number or vector clock that provides a consistent
ordering of events across services, independent of wall clock time.
**For MVP**: A monotonically increasing sequence number per account, stored
in the database. Each ledger entry carries the account's sequence number at
time of creation.
**SOLVES**: FM-007 (Clock Skew in Settlement)
**REQUIRES**: Centralized sequence generation (use database sequences, not
application-level counters) to guarantee monotonicity.

---

## Part 3 — Conflict Matrix

Quick reference for incompatible design choices.

| Node A | Node B | Conflict | Resolution |
|--------|--------|----------|------------|
| SAGA_PATTERN | 2PC | Cannot mix in same flow | Pick one. Saga for services you don't own. 2PC for services you own with XA support. |
| OPTIMISTIC_LOCKING | Read Replica for balance | Race condition window | Always read balance from primary for check-then-act operations. |
| Redis IDEMPOTENCY_STORE | Critical payment path | Key eviction risk | Use PostgreSQL for payment idempotency. Redis acceptable for non-critical. |
| Async COMPLIANCE_GATE | Hard regulatory blocks | Blocks cannot be async | Synchronous gate for hard blocks. Async only for informational scoring. |
| FLOAT storage | Monetary amounts | Precision loss | Always use BIGINT (minor units) or DECIMAL(19,4). |

---

## Part 4 — Implicit Constraints (Always Applied)

These constraints are applied to EVERY fintech system design regardless of
the prompt. They are never asked as clarification questions.

1. **Observability is mandatory.** Every payment event must emit a structured
   log entry with: transaction_id, account_id, amount, currency, status,
   latency_ms, and error_code (if applicable).

2. **Audit trail is immutable.** Ledger entries are append-only. No UPDATE
   or DELETE on financial records. Corrections are made via compensating entries.

3. **Secrets never in code.** API keys, webhook secrets, and database
   credentials are always environment variables or a secrets manager. This
   is not asked — it is enforced in the scaffold.

4. **Amounts in minor units.** All internal representations use integers.
   Conversion to display format is the frontend's responsibility.

5. **Idempotency on all mutations.** Every POST/PUT endpoint that triggers
   a financial state change requires an idempotency key. This is not optional.

6. **Health checks are not optional.** Every service must expose a `/health`
   endpoint that checks database connectivity and returns degraded status if
   the payment processor is unreachable.
