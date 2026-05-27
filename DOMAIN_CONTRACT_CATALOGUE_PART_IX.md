# Part IX -- System-Level Contracts

This section defines the ten concerns that every enterprise system must address but that per-module function signatures alone cannot express. These concerns apply across all modules in the catalogue. Each concern is defined as a formal specification, followed by worked examples using modules already defined in Parts I–VIII.

---

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
       on_failure: abort -- no compensation needed, nothing committed

    2. payments.initiatePayment(order_id, amount, currency, method) → Payment
       on_failure: inventory.releaseStock(reservation_token)

    3. orders.transitionOrderStatus(order_id, "confirmed") → Order
       on_failure: payments.initiateRefund(payment_id, "order_confirmation_failed")
                   inventory.releaseStock(reservation_token)

    4. notifications.sendEmail(user_id, "order_confirmed", variables) → DeliveryResult
       on_failure: log and continue -- notification failure must not reverse a confirmed order

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
                   -- alert operations team

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
       on_failure: log and continue -- audit failure must not reverse cancellation

  invariant: entitlement must not be active when subscription is cancelled
  timeout: 15 seconds
```

---

### Cross-Module Contract Rules

**Rule 1 -- Compensation is required for every step with external side effects.**
A step has external side effects if it mutates state in any module. Notification delivery is an exception -- it must never block or reverse business operations.

**Rule 2 -- Compensation must be idempotent.**
`releaseStock`, `initiateRefund`, and all other compensation operations will be called at least once. They must handle duplicate calls without producing incorrect state.

**Rule 3 -- The saga orchestrator must be the single source of truth.**
No individual module knows it is part of a saga. The orchestrating service holds the saga state. If the orchestrator crashes, the saga must be resumable from the last committed step.

**Rule 4 -- Notification failures never reverse business operations.**
Email, SMS, and push delivery failures are operational concerns, not domain failures. A confirmed order remains confirmed even if the confirmation email fails.

---

## 9.2 Error Contracts

### What They Are

Every function in the catalogue has a success path. Every function also has a failure taxonomy -- a named set of domain errors that are not exceptions but expected outcomes with precise semantics. Callers must handle each named error differently. If the error contract is unspecified, every adapter invents error codes and every caller handles them inconsistently.

### Specification Format

```
errors <module>
  <FunctionName>:
    <ErrorCode>: <description> | <caller_action>
```

### Universal Error Types

These apply to every function in every module unless overridden.

```
errors universal
  any_function:
    not_found:          The requested resource does not exist | return null or 404
    unauthorized:       The caller does not have permission | return 401, do not retry
    validation_error:   Input failed contract validation | return 400, do not retry
    rate_limited:       Too many requests | retry after retry_after seconds
    provider_error:     The underlying provider returned an unrecoverable error | alert and retry with backoff
    timeout:            The operation exceeded its time bound | retry with idempotency key
```

### Module Error Contracts

---

**`auth`**
```
errors auth
  signIn:
    invalid_credentials:       Email or password incorrect | return 401, do not reveal which
    account_not_verified:      Email verification required | prompt verification flow
    account_banned:            Account is permanently banned | return 403, do not retry
    account_suspended:         Temporary suspension | return 403 with suspension_until
    too_many_attempts:         Brute force protection triggered | return 429 with lockout_until
    provider_token_invalid:    OAuth token rejected by provider | restart OAuth flow

  refreshToken:
    token_expired:             Refresh token has passed its TTL | force re-authentication
    token_revoked:             Session was explicitly revoked | force re-authentication
    token_reuse_detected:      Refresh token used more than once (rotation violation) | revoke all sessions, force re-auth
```

---

**`payments`**
```
errors payments
  initiatePayment:
    insufficient_funds:        Wallet or card balance too low | prompt top-up or alternative method
    card_declined:             Card issuer declined | prompt alternative payment method
    card_expired:              Card past expiry date | prompt card update
    currency_not_supported:    Provider does not support this currency | show supported currencies
    duplicate_reference:       Idempotency key already used with different parameters | return original result
    provider_unavailable:      Payment provider is down | retry with exponential backoff
    fraud_blocked:             Transaction blocked by fraud detection | require manual review
    limit_exceeded:            Transaction exceeds daily or per-transaction limit | inform user of limit

  initiateRefund:
    refund_window_expired:     Refund period has passed | escalate to manual process
    already_refunded:          Payment has already been fully refunded | return existing refund
    partial_refund_not_supported: Provider does not support partial refunds | refund full amount or reject
    payment_not_settled:       Original payment not yet settled | retry after settlement window

  creditWallet:
    duplicate_credit:          Same reference already credited | return existing transaction (idempotent)

  debitWallet:
    insufficient_balance:      Balance too low and allow_negative not set | return error with current balance
    wallet_frozen:             Wallet is under investigation | return 403
```

---

**`inventory`**
```
errors inventory
  reserveStock:
    insufficient_stock:        Available quantity less than requested | return available quantity
    variant_discontinued:      Variant no longer available | suggest alternatives
    reservation_limit_exceeded: Too many open reservations for this variant | retry after expiry window

  confirmStock:
    reservation_expired:       Token TTL has passed | create new reservation or cancel order
    reservation_not_found:     Token does not exist or already confirmed | check idempotency
    quantity_mismatch:         Confirmation quantity differs from reservation | reject

  releaseStock:
    reservation_already_released: Token already released | no-op (idempotent)
```

---

**`orders`**
```
errors orders
  transitionOrderStatus:
    invalid_transition:        Transition not permitted by state machine | return valid transitions
    order_locked:              Order is being modified by another process | retry after lock_expires_at
    missing_prerequisite:      Required prior action not completed | return prerequisite details

  cancelOrder:
    cancellation_window_expired: Order past cancellation deadline | escalate to return flow
    order_already_shipped:     Cannot cancel after shipment | initiate return instead
```

---

**`queues`**
```
errors queues
  enqueue:
    queue_full:                Queue has reached capacity limit | return retry_after
    payload_too_large:         Payload exceeds maximum size | split or compress payload

  retryJob:
    max_attempts_reached:      Job has exhausted retry budget | move to dead letter queue
    job_not_retryable:         Job type does not permit manual retry | reject
```

---

### Error Propagation Rule

When a saga step fails with a domain error, the error must propagate to the saga orchestrator with its full error code preserved. The orchestrator must not swallow error codes or reclassify them as generic failures. The caller of the saga receives the specific domain error from the step that failed, not a generic "order creation failed" message.

---

## 9.3 Consistency Guarantees

### What They Are

Every module operates under a consistency model that determines what a caller can assume after a successful call. This is not an implementation detail -- it determines how callers must be written and what tests are valid.

### Consistency Model Definitions

```
strong:            Read after write reflects the write. Guaranteed within a single region.
read_your_writes:  The writer always sees their own write. Other readers may lag.
eventual:          Write will be reflected in all reads within a bounded time window.
causal:            Causally related operations are seen in order by all observers.
```

### Module Consistency Declarations

| Module | Model | Notes |
|---|---|---|
| `auth` | strong | Token validation must reflect revocation immediately |
| `users` | strong | Permission changes must be visible before the response returns |
| `permissions` | strong | `can()` must reflect the latest grant/revoke |
| `sessions` | strong | Revoked sessions must be rejected immediately |
| `api_keys` | strong | Revoked keys must be rejected immediately |
| `payments` | strong | Balance changes must be immediately consistent |
| `inventory` | strong | `available = on_hand - reserved` must hold at all times |
| `cart` | read_your_writes | Cart owner always sees their own updates; other processes may lag briefly |
| `orders` | strong | Status transitions must be immediately visible |
| `billing` | strong | Subscription status must reflect cancellation immediately |
| `wallet` | strong | Balance must never show stale data to the wallet owner |
| `notifications` | eventual | Delivery status updates are eventually consistent |
| `audit_log` | eventual | Query results may lag by up to 5 seconds; `recordEvent` is durable |
| `analytics` | eventual | Event tracking is best-effort; metrics may lag by minutes |
| `search` | eventual | Index updates are eventually reflected in search results |
| `caching` | eventual | By definition -- cache invalidation is asynchronous |
| `feature_flags` | eventual | Flag changes propagate within the flag evaluation TTL |
| `presence` | eventual | Presence state converges within the TTL window |
| `queues` | causal | A job enqueued after another must not execute before it in the same queue |
| `usage_metering` | eventual | `recordUsage` is eventually consistent; `checkQuota` reflects committed records |
| `tenants` | strong | Suspension must be immediately enforced |
| `consent` | strong | Withdrawal must be immediately honoured |

### Consistency Enforcement Rule

A module declaring `strong` consistency must enforce it at the data layer -- not via caching, not via optimistic reads. A module declaring `eventual` consistency must declare the maximum lag bound in its adapter documentation. Any caller that reads immediately after writing to an `eventual` module must be written to tolerate stale data.

---

## 9.4 Idempotency Keys

### What They Are

An idempotency key is a caller-generated unique identifier attached to any state-mutating operation with external side effects. The module guarantees that multiple calls with the same key produce the same result and execute the side effect exactly once.

This is not optional for the operations listed below. Network failures, client retries, and distributed system instability mean any operation may be called more than once. The contract specifies which calls must accept idempotency keys, the guarantee provided, and the key retention period.

### Universal Idempotency Convention

All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument. If not provided, the operation is not idempotent and a duplicate call produces a duplicate effect.

When `idempotency_key` is provided:
- If the key has not been seen before: execute the operation, store the result, return the result
- If the key has been seen and the operation completed: return the stored result without re-executing
- If the key has been seen and the operation is in progress: return `409 Conflict` with `retry_after`
- If the key has been seen but with different parameters: return `422 Unprocessable` -- the key is bound to its first set of parameters

### Key Retention Period

Idempotency keys must be retained for a minimum of 24 hours. For financial operations (`payments`, `wallet`), keys must be retained for 7 days.

### Functions That Must Accept Idempotency Keys

```
payments:
  initiatePayment(order_id, amount, currency, method, idempotency_key?)
  creditWallet(user_id, amount, currency, reference, idempotency_key?)
  debitWallet(user_id, amount, currency, reference, idempotency_key?)
  initiateRefund(payment_id, amount?, reason, idempotency_key?)

orders:
  createOrder(cart_id, user_id, shipping_address, payment_method, idempotency_key?)
  transitionOrderStatus(order_id, status, metadata?, idempotency_key?)
  cancelOrder(order_id, reason, idempotency_key?)

inventory:
  reserveStock(variant_id, quantity, order_id, idempotency_key?)
  confirmStock(reservation_token, idempotency_key?)
  adjustStock(variant_id, delta, reason, idempotency_key?)

notifications:
  sendEmail(to, template_id, variables, options?, idempotency_key?)
  sendSMS(to, body, options?, idempotency_key?)

queues:
  enqueue(queue_name, payload, options?, idempotency_key?)

billing:
  createSubscription(user_id, plan_id, payment_method, idempotency_key?)
  cancelSubscription(user_id, at_period_end?, idempotency_key?)

loyalty:
  earnPoints(user_id, amount, reason, reference, idempotency_key?)
  redeemPoints(user_id, amount, reference, idempotency_key?)

audit_log:
  recordEvent(event, idempotency_key?)
```

### Note on `reference` Fields

Several modules (`creditWallet`, `earnPoints`, `redeemPoints`) already include a `reference` field. When present, `reference` serves as the idempotency key for that operation. A separate `idempotency_key` parameter is not needed if `reference` is provided. The module must enforce uniqueness on `reference` and return the existing result on duplicate.

---

## 9.5 Pagination Contract

### What It Is

`PaginatedResult<T>` is referenced throughout the catalogue but never defined. This section defines it canonically. All paginated functions must use cursor-based pagination. Offset-based pagination is not permitted in this catalogue because it produces incorrect results under concurrent inserts and is unsuitable for large datasets.

### Canonical Type Definition

```
PaginatedResult<T> {
  data:        T[]
  cursor:      string?          ← opaque cursor for the next page; null means no more pages
  has_more:    boolean
  total:       number?          ← total count, omitted if expensive to compute
}

PaginationOptions {
  cursor?:     string           ← cursor from previous page; omit for first page
  limit?:      number           ← default 20, maximum 100
  order?:      asc | desc       ← default desc (newest first)
}
```

### Cursor Semantics

A cursor is opaque to the caller. It must not be parsed, constructed, or persisted beyond the immediate pagination session. Internally, a cursor encodes the sort key value of the last item returned, the sort direction, and a version identifier. This enables stable pagination under concurrent inserts.

The cursor is stable for the duration of a pagination session but is not guaranteed to remain valid across module restarts or schema migrations.

### Sort Key Requirements

Every function returning `PaginatedResult<T>` must declare its sort key. The sort key must be indexed in the underlying data store. The following sort keys apply to catalogue modules:

```
orders.getOrdersByUser:         created_at DESC
payments.getWalletTransactions: created_at DESC
notifications.getNotifications: created_at DESC
audit_log.queryEvents:          created_at DESC
messages.getMessages:           created_at ASC (oldest first for thread display)
reviews.getReviews:             created_at DESC
queues.getJobStatus:            run_at ASC (next to execute first)
search.search:                  score DESC (relevance first)
users.searchUsers:              created_at DESC
```

### Empty Result Convention

A function returning `PaginatedResult<T>` with no results must return `{ data: [], cursor: null, has_more: false }`. It must not return `null` or throw.

---

## 9.6 Event Emission Contract

### What It Is

Every state-mutating function in the catalogue emits one or more typed domain events via the `events` pubsub module. These events are how modules communicate without direct coupling. Without a specified event emission contract, adapters emit different events with different payloads, and downstream consumers cannot be written portably.

### Event Naming Convention

```
<module>.<entity>.<past_tense_verb>

Examples:
  order.status.transitioned
  payment.initiated
  payment.completed
  payment.refund.initiated
  user.banned
  subscription.cancelled
  inventory.stock.reserved
  inventory.stock.released
```

### Event Envelope

All events share a common envelope regardless of module.

```
DomainEvent<T> {
  id:           string         ← globally unique, UUID v4
  topic:        string         ← follows naming convention above
  version:      string         ← semver of the event schema, e.g. "1.0"
  timestamp:    ISO8601
  source:       string         ← module name
  actor:        EventActor
  payload:      T
  correlation_id: string?      ← saga or request ID for tracing
  idempotency_key: string?     ← key of the originating operation if applicable
}

EventActor {
  type:  user | system | api_key | service
  id:    string
}
```

### Delivery Guarantee

All events in this catalogue use **at-least-once** delivery. Consumers must be idempotent -- processing the same event twice must produce the same result. The `id` field is the deduplication key.

### Module Event Emission Specifications

---

**`auth`**
```
events emitted by auth:
  signUp            → auth.user.registered      { user_id, email, provider }
  signIn            → auth.user.signed_in        { user_id, ip_address, provider }
  signOut           → auth.user.signed_out       { user_id, session_id }
  banUser           → auth.user.banned           { user_id, reason, banned_by }
  requestPasswordReset → auth.password.reset_requested { user_id, email }
```

---

**`orders`**
```
events emitted by orders:
  createOrder             → order.created              { order_id, user_id, total, currency, line_count }
  transitionOrderStatus   → order.status.transitioned  { order_id, from_status, to_status, metadata }
  cancelOrder             → order.cancelled            { order_id, reason, cancelled_by }
  requestReturn           → order.return.requested     { order_id, return_id, lines, reason }
  approveReturn           → order.return.approved      { return_id, order_id, refund_amount }
  transitionPackageStatus → order.package.status.transitioned { package_id, order_id, from_status, to_status }
```

---

**`payments`**
```
events emitted by payments:
  initiatePayment   → payment.initiated          { payment_id, order_id, amount, currency, method }
  verifyPayment     → payment.completed          { payment_id, order_id, amount, provider_reference }
                   OR payment.failed             { payment_id, order_id, reason }
  initiateRefund    → payment.refund.initiated   { refund_id, payment_id, amount, reason }
  creditWallet      → wallet.credited            { user_id, amount, currency, balance_after, reference }
  debitWallet       → wallet.debited             { user_id, amount, currency, balance_after, reference }
```

---

**`inventory`**
```
events emitted by inventory:
  reserveStock      → inventory.stock.reserved   { token, variant_id, quantity, order_id, expires_at }
  releaseStock      → inventory.stock.released   { token, variant_id, quantity, reason: expired|cancelled }
  confirmStock      → inventory.stock.confirmed  { token, variant_id, quantity }
  adjustStock       → inventory.stock.adjusted   { variant_id, delta, on_hand_after, reason }
  getLowStockAlerts → inventory.stock.low        { variant_id, available, threshold }
```

---

**`users`**
```
events emitted by users:
  createUser        → user.created               { user_id, email }
  updateUser        → user.updated               { user_id, changed_fields }
  deleteUser        → user.deleted               { user_id }
  banUser           → user.banned                { user_id, reason, banned_by }
  unbanUser         → user.unbanned              { user_id, unbanned_by }
  assignRole        → user.role.assigned         { user_id, role }
  revokeRole        → user.role.revoked          { user_id, role }
```

---

**`billing`**
```
events emitted by billing:
  createSubscription    → subscription.created     { user_id, plan_id, trial_ends_at? }
  cancelSubscription    → subscription.cancelled   { user_id, plan_id, cancel_at }
  upgradeSubscription   → subscription.upgraded    { user_id, from_plan, to_plan }
  downgradeSubscription → subscription.downgraded  { user_id, from_plan, to_plan, effective_at }
```

---

**`tenants`**
```
events emitted by tenants:
  createTenant      → tenant.created             { tenant_id, name, owner_id }
  suspendTenant     → tenant.suspended           { tenant_id, reason }
  reactivateTenant  → tenant.reactivated         { tenant_id }
  inviteMember      → tenant.member.invited      { tenant_id, email, role }
  removeMember      → tenant.member.removed      { tenant_id, user_id }
```

---

**`kyc`**
```
events emitted by kyc:
  submitVerification  → kyc.verification.submitted  { request_id, user_id, document_types }
  approveVerification → kyc.verification.approved   { request_id, user_id }
  rejectVerification  → kyc.verification.rejected   { request_id, user_id, reason }
```

---

**`consent`**
```
events emitted by consent:
  recordConsent     → consent.granted            { user_id, purposes, version }
  withdrawConsent   → consent.withdrawn          { user_id, purposes }
  deleteUserData    → consent.data_deletion.requested { user_id, job_id }
```

---

### Consumer Conventions

A module that consumes another module's events must declare its subscription in its adapter documentation. The consuming module must not call the emitting module's functions in response to events -- it must handle the event payload directly. This prevents circular dependencies at runtime.

Example: `billing` consumes `auth.user.registered` to create a default free-tier subscription. It handles the event payload directly. It does not call `auth.getUser` to get additional data -- all required data must be in the event payload.

This means event payloads must be self-contained. An event that requires a secondary lookup to be useful is an incomplete event contract.

---

## 9.7 Temporal Constraints

### What They Are

State machines define valid transitions. Temporal constraints define the time bounds within which those transitions must occur, what happens when they expire, and which operations have maximum durations.

### Temporal Constraint Format

```
temporal <module>
  <operation_or_state>:
    max_duration:   <duration>
    on_expiry:      <compensation_or_transition>
    warning_at:     <percentage of max_duration>
```

### Module Temporal Constraints

---

**`inventory`**
```
temporal inventory
  StockReservation (reserved state):
    max_duration:  15 minutes
    on_expiry:     auto-release reservation
                   emit inventory.stock.released { reason: "expired" }
                   transition order to "reservation_expired" if not confirmed
    warning_at:    80% (12 minutes) -- emit inventory.stock.reservation_expiring_soon

  confirmStock:
    max_duration:  5 seconds
    on_expiry:     return timeout error -- caller must retry with same idempotency key
```

---

**`payments`**
```
temporal payments
  Payment (pending state):
    max_duration:  30 minutes
    on_expiry:     transition to failed
                   emit payment.failed { reason: "timeout" }
                   release inventory reservation via saga compensation

  Payment (processing state):
    max_duration:  5 minutes
    on_expiry:     poll provider for status
                   if no response after 3 polls: transition to failed

  initiatePayment:
    max_duration:  10 seconds per attempt
    on_expiry:     return timeout error -- caller must retry with same idempotency key

  Refund (pending state):
    max_duration:  5 business days
    on_expiry:     alert operations team -- do not auto-cancel
```

---

**`orders`**
```
temporal orders
  Order (pending state, awaiting payment):
    max_duration:  30 minutes
    on_expiry:     transition to cancelled
                   release stock reservation
                   emit order.cancelled { reason: "payment_timeout" }

  Order (processing state):
    max_duration:  3 business days
    on_expiry:     alert operations team

  ReturnRequest (pending state):
    max_duration:  48 hours (seller review window)
    on_expiry:     auto-approve if policy allows
                   else alert operations team

  cancelOrder:
    deadline:      before order transitions to shipped
    after_deadline: route to return flow instead
```

---

**`auth`**
```
temporal auth
  PasswordResetToken:
    max_duration:  1 hour
    on_expiry:     token becomes invalid -- user must request new reset

  EmailVerificationToken:
    max_duration:  24 hours
    on_expiry:     token becomes invalid -- resendVerification available

  Session (access_token):
    max_duration:  15 minutes (default, configurable)
    on_expiry:     force refresh via refreshToken

  Session (refresh_token):
    max_duration:  30 days (default, configurable)
    on_expiry:     force re-authentication

  signIn lockout (too_many_attempts):
    lockout_duration: 15 minutes
    on_expiry:        reset attempt counter
```

---

**`sessions`**
```
temporal sessions
  Session (active):
    inactivity_timeout: 30 minutes (configurable)
    on_expiry:          transition to expired
                        emit auth.session.expired
    absolute_timeout:   24 hours regardless of activity
```

---

**`kyc`**
```
temporal kyc
  VerificationRequest (pending):
    max_duration:    5 business days
    on_expiry:       transition to expired
                     notify user to resubmit

  VerificationRequest (approved):
    validity:        2 years (configurable by regulation)
    on_expiry:       transition to expired
                     require re-verification for regulated operations
```

---

**`queues`**
```
temporal queues
  Job (waiting):
    max_wait:       configurable per queue, default 24 hours
    on_expiry:      transition to failed with reason "max_wait_exceeded"

  Job retry backoff:
    strategy:       exponential with jitter
    initial_delay:  30 seconds
    max_delay:      1 hour
    max_attempts:   configurable, default 3
```

---

**`caching`**
```
temporal caching
  CacheEntry:
    ttl:            set by caller in CacheOptions
    on_expiry:      evict silently -- next get() returns null
    maximum_ttl:    24 hours -- entries with longer TTL must use explicit invalidation instead
```

---

**`api_keys`**
```
temporal api_keys
  ApiKey (with expires_at set):
    on_expiry:      transition to expired
                    validateApiKey returns { valid: false, reason: "expired" }
    warning:        7 days before expiry -- emit api_key.expiring_soon to owner
```

---

**`feature_flags`**
```
temporal feature_flags
  Flag evaluation cache:
    max_age:        30 seconds (default) -- flag evaluation must not serve data older than this
    on_expiry:      refetch from source

  Flag (with time-based rollout rule):
    start_at/end_at: enforced by the evaluation engine, not by caller
```

---

### Temporal Constraint Rule

Every module that specifies a `max_duration` for a state must have an automated background process that enforces expiry. The expiry must emit the specified event. Expiry enforcement is the responsibility of the module's adapter, not the caller.

---

## 9.8 Observability Contract

### What It Is

A module is not operable in production unless it emits structured telemetry. This section specifies the minimum instrumentation every adapter must implement: distributed tracing spans, metrics, and structured log fields.

These are not suggestions. An adapter that does not implement this contract is not compliant with the catalogue.

### Distributed Tracing Convention

Every function call creates a span. Span names follow the pattern `<module>.<function>`. Spans must be children of the incoming request span when one exists.

**Required span attributes (all functions)**
```
module:           string    ← catalogue module name
function:         string    ← function name
result:           success | failure | not_found
duration_ms:      number
```

**Additional attributes for financial operations**
```
currency:         string
amount_cents:     number    ← integer, never float
idempotency_key:  string?
```

**Additional attributes for state transitions**
```
from_state:       string
to_state:         string
entity_id:        string
```

### Metrics Specification

Every module must expose the following metrics. Metric names follow the pattern `gensense_<module>_<operation>_<measure>`.

**Universal metrics (all modules)**
```
gensense_<module>_operation_total          counter   { function, result: success|failure }
gensense_<module>_operation_duration_ms    histogram { function, p50, p95, p99 }
gensense_<module>_errors_total             counter   { function, error_code }
```

**Module-specific metrics**

```
payments:
  gensense_payments_initiation_total           { method, currency, result }
  gensense_payments_amount_total               { currency }  ← sum of amounts
  gensense_payments_refund_total               { reason }
  gensense_wallet_balance_snapshot             gauge { currency }

inventory:
  gensense_inventory_reservations_active       gauge { variant_id? }
  gensense_inventory_stock_level               gauge { variant_id, location_id? }
  gensense_inventory_reservation_expiry_total  counter { reason: expired|confirmed|released }

orders:
  gensense_orders_created_total               { currency }
  gensense_orders_by_status                   gauge { status }
  gensense_orders_cancellation_total          { reason }

auth:
  gensense_auth_signin_total                  { provider, result }
  gensense_auth_token_refresh_total           { result }
  gensense_auth_failed_attempts_total         { reason }

notifications:
  gensense_notifications_sent_total           { channel, result }
  gensense_notifications_bounce_total         { channel }

queues:
  gensense_queues_depth                       gauge { queue_name, status }
  gensense_queues_job_duration_ms             histogram { queue_name }
  gensense_queues_dead_letter_total           { queue_name }
```

### Structured Log Fields

Every log line emitted by a module must include these fields. Log lines must be JSON-structured.

```
Required fields (all log lines):
  module:         string
  function:       string
  trace_id:       string    ← from distributed trace context
  span_id:        string
  level:          debug | info | warn | error
  timestamp:      ISO8601

Required fields for state transitions:
  entity_type:    string
  entity_id:      string
  from_state:     string
  to_state:       string

Required fields for errors:
  error_code:     string    ← catalogue domain error code
  error_message:  string
  retryable:      boolean

Prohibited fields (never log these):
  password, password_hash
  access_token, refresh_token
  card_number, cvv, expiry
  raw_api_key
  wallet_balance (log balance_after only on transactions, never as a standalone field)
```

### SLO Targets

These are the minimum SLO targets for compliant adapters. Adapters that cannot meet these targets under normal load must document their actual targets.

```
Availability:     99.9% per module per month
Latency p99:
  auth.*:         200ms
  payments.*:     500ms (provider-dependent, document actual)
  inventory.*:    100ms
  orders.*:       200ms
  notifications.* 1000ms (async delivery excluded)
  search.*:       150ms
  caching.*:      10ms
  queues.enqueue: 50ms
Error rate:       < 0.1% for client errors, < 0.01% for server errors
```

---

## 9.9 Module Dependency Graph

### What It Is

A dependency graph declares which modules a given module requires to function. This determines deployment order, test isolation requirements, and failure blast radius analysis.

A module may **depend** on another (requires it to function), **recommend** another (works better with it), or **emit to** another (publishes events to it).

### Dependency Graph

```
auth
  depends_on:     sessions, users
  emits_to:       events
  recommends:     audit_log, rate_limiting, notifications

users
  depends_on:     (none -- owns its own data)
  emits_to:       events
  recommends:     audit_log, notifications, permissions

permissions
  depends_on:     users
  emits_to:       events
  recommends:     audit_log, caching (for permission evaluation caching)

sessions
  depends_on:     (none)
  emits_to:       events
  recommends:     caching (for session storage), audit_log

api_keys
  depends_on:     users
  emits_to:       events
  recommends:     audit_log, rate_limiting

notifications
  depends_on:     users (for preference lookup)
  emits_to:       events
  recommends:     queues (for async delivery), audit_log

messaging
  depends_on:     users
  emits_to:       events
  recommends:     notifications (for new message alerts), storage (for attachments)

storage
  depends_on:     (none -- wraps external provider)
  emits_to:       events
  recommends:     audit_log

caching
  depends_on:     (none -- infrastructure primitive)
  emits_to:       (none)
  recommends:     (none)

queues
  depends_on:     (none -- infrastructure primitive)
  emits_to:       (none)
  recommends:     audit_log

search
  depends_on:     (none -- wraps external provider)
  emits_to:       (none)
  recommends:     (none)

feature_flags
  depends_on:     (none)
  emits_to:       (none)
  recommends:     caching (for flag evaluation caching), audit_log

rate_limiting
  depends_on:     (none)
  emits_to:       (none)
  recommends:     caching

audit_log
  depends_on:     (none -- must be dependency-free to avoid circular dependencies)
  emits_to:       (none)
  recommends:     (none)

analytics
  depends_on:     (none -- fire and forget)
  emits_to:       (none)
  recommends:     queues (for buffered ingestion)

catalog
  depends_on:     (none)
  emits_to:       events
  recommends:     search, caching

inventory
  depends_on:     catalog (for variant existence validation)
  emits_to:       events
  recommends:     caching (for stock level reads), queues (for expiry processing)

cart
  depends_on:     catalog, inventory, promotions
  emits_to:       events
  recommends:     caching (for cart state)

promotions
  depends_on:     catalog
  emits_to:       events
  recommends:     caching (for active flash sale lookup)

orders
  depends_on:     cart, inventory, payments, users
  emits_to:       events
  recommends:     notifications, audit_log, shipping

payments
  depends_on:     (none -- wraps external provider + owns wallet)
  emits_to:       events
  recommends:     audit_log, notifications, fraud_detection

shipping
  depends_on:     orders
  emits_to:       events
  recommends:     notifications (for tracking updates)

reviews
  depends_on:     users, orders (to verify purchase)
  emits_to:       events
  recommends:     notifications, audit_log

billing
  depends_on:     payments, users
  emits_to:       events
  recommends:     notifications, audit_log, usage_metering

usage_metering
  depends_on:     (none)
  emits_to:       (none)
  recommends:     caching (for quota reads), billing (to trigger overage billing)

tenants
  depends_on:     users, billing
  emits_to:       events
  recommends:     notifications, audit_log, feature_flags

consent
  depends_on:     users
  emits_to:       events
  recommends:     audit_log, queues (for data deletion jobs), analytics (for consent-gated tracking)

kyc
  depends_on:     users
  emits_to:       events
  recommends:     audit_log, notifications, storage (for document storage)

fraud_detection
  depends_on:     (none -- wraps external provider or rules engine)
  emits_to:       events
  recommends:     audit_log, ip_intelligence, rate_limiting

appointments
  depends_on:     users
  emits_to:       events
  recommends:     notifications, audit_log, payments (for paid appointments)

loyalty
  depends_on:     users, orders (to trigger point earning)
  emits_to:       events
  recommends:     notifications, audit_log

subscriptions
  depends_on:     billing
  emits_to:       events
  recommends:     feature_flags (for entitlement-gated features)
```

### Deployment Order

From the dependency graph, the safe deployment order (no module deployed before its dependencies) is:

```
Tier 0 (no dependencies):
  caching, queues, audit_log, analytics, storage, search,
  feature_flags, rate_limiting, usage_metering, fraud_detection

Tier 1 (depends on Tier 0 only):
  users, sessions, payments, catalog, notifications (needs users)

Tier 2 (depends on Tier 0-1):
  auth, permissions, api_keys, inventory, promotions, billing,
  ip_intelligence, consent

Tier 3 (depends on Tier 0-2):
  cart, shipping, kyc, tenants, messaging, subscriptions,
  loyalty, appointments

Tier 4 (depends on Tier 0-3):
  orders, reviews

Tier 5 (depends on Tier 0-4):
  (all sagas -- deployed as orchestration services, not modules)
```

### Blast Radius Analysis

If `payments` is unavailable:
- `orders.createOrder` fails at step 2 (payment initiation)
- `billing.createSubscription` fails
- `loyalty.redeemPoints` (if backed by payment) fails
- All sagas involving payment fail at the payment step with compensation

If `inventory` is unavailable:
- `orders.createOrder` fails at step 1 (stock reservation)
- `cart.addToCart` cannot check availability (degrades gracefully if stock check is optional)

If `notifications` is unavailable:
- All sagas continue -- notification steps are non-blocking
- Users do not receive confirmations -- operational concern, not domain failure

If `audit_log` is unavailable:
- No module fails -- audit_log is `recommends`, not `depends_on`, for all modules
- Events are buffered and replayed when audit_log recovers

---

## 9.10 Contract Evolution Rules

### What They Are

Contracts change. This section specifies what constitutes a breaking change, what is a safe addition, how adapters declare which version they implement, and what the compatibility guarantee is between versions.

Without these rules, every contract change breaks every adapter. With these rules, the catalogue can evolve without forcing coordinated updates across all consumers.

### Semver for Contracts

Contract versions follow semantic versioning: `MAJOR.MINOR.PATCH`

```
PATCH (1.0.0 → 1.0.1):
  - Corrected a description or clarified invariant text
  - Added a note or example
  - No change to function signatures, types, or invariants
  - No adapter update required

MINOR (1.0.0 → 1.1.0):
  - Added a new optional function to a module
  - Added a new optional field to an existing type
  - Added a new error code that callers may receive
  - Added a new event emitted by a module
  - Relaxed an invariant (removed a restriction)
  - Adapters implementing 1.0.x automatically satisfy 1.1.x unless they call new functions

MAJOR (1.0.0 → 2.0.0):
  - Removed a function
  - Renamed a function
  - Changed the parameters of a function (added required parameters, removed parameters, changed types)
  - Changed the return type of a function
  - Added a required field to an existing type
  - Removed a field from an existing type
  - Changed a field type
  - Strengthened an invariant (added a restriction)
  - Adapters must explicitly update to declare MAJOR version compliance
```

### Adapter Version Declaration

Every adapter must declare which contract version it implements. The declaration is a module-level metadata object.

```typescript
// TypeScript adapter example
export const metadata = {
  module: "payments",
  contract_version: "1.2.0",
  adapter: "stripe",
  adapter_version: "2.0.1",
}
```

```rust
// Rust adapter example
pub const CONTRACT_VERSION: &str = "1.2.0";
pub const ADAPTER_NAME: &str = "stripe";
```

### Compatibility Guarantee

An adapter declaring contract version `1.2.0` is guaranteed to:
- Implement all functions present in version `1.0.0` (the major version baseline)
- Implement optional functions added in `1.1.x` and `1.2.x` if they appear in its declaration
- Accept but ignore unknown optional fields in input types
- Return unknown optional fields that appear in newer patch versions as absent

An adapter declaring contract version `1.2.0` is **not** guaranteed to:
- Work with a caller written for `2.0.0` (different major version)
- Return new required fields introduced in `1.3.0` (higher minor version)

### Deprecation Policy

A function or field may be deprecated before removal. Deprecation must be announced in a MINOR version. Removal happens in the next MAJOR version. The minimum time between deprecation announcement and removal is one MAJOR version cycle.

```
1.3.0 -- deprecate payments.getPaymentByOrder (replaced by payments.getPayment with order_id filter)
2.0.0 -- remove payments.getPaymentByOrder
```

During the deprecation window, the function must remain fully functional and must not emit warnings that break callers.

### Schema Migration Rule

When a MAJOR version changes a type (adds a required field, changes a field type), the transition must be handled by a versioned event schema. Both the old and new event schemas must be valid during a migration window. Consumers declare which event schema version they consume.

```
payment.completed v1.0:  { payment_id, order_id, amount }
payment.completed v2.0:  { payment_id, order_id, amount, processor_fee, net_amount }

During migration window: events module routes v1 consumers to v1 schema, v2 consumers to v2 schema.
After migration window: v1 schema is retired. All consumers must have updated to v2.
```

---

## How to Read Each Module (Revised)

The full module specification includes all ten concerns. Not every module documents all ten concerns exhaustively -- the catalogue focuses on the concerns most relevant to each module. The universal rules in this Part IX apply to all modules.

Each module entry may include:

- **Functions** -- operation signatures with idempotency key where required
- **Types** -- data structures including full error taxonomy
- **State Machine** -- valid state transitions and terminal states
- **Invariants** -- behavioral constraints an implementation must satisfy
- **Consistency Model** -- strong, read_your_writes, eventual, or causal
- **Events Emitted** -- typed domain events with payload shapes
- **Temporal Constraints** -- maximum durations, expiry behaviors, deadlines
- **Errors** -- named domain error taxonomy per function
- **Cross-Module Contracts** -- sagas this module participates in
- **Observability** -- required spans, metrics, and log fields
- **Contract Version** -- current version and deprecation notices
- **Providers** -- examples of what an adapter might wrap

---

*Part IX added to Version 0.2 -- Domain Contract Catalogue*
*Parts I–VIII remain unchanged. This section supersedes the original "How to Read Each Module" preamble.*
