### Addition 1: Database schemas for every module

The contracts define what functions do and what types they return. They don't define how to store those types. A senior engineer immediately thinks about the database layout when they see a contract — which columns, which indexes, which foreign keys, which constraints enforce the invariants.

Every module should have a canonical database schema section. This belongs in Blueprint (not in Fwen's weights) because it changes per database engine and should be queryable at inference time.

```markdown
# Proposed addition to each contract — example: payments

## Database Schema

### PostgreSQL
```sql
CREATE TABLE payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id),
  amount        BIGINT NOT NULL CHECK (amount > 0),   -- always in smallest unit (cents)
  currency      CHAR(3) NOT NULL,
  status        payment_status NOT NULL DEFAULT 'pending',
  method        payment_method NOT NULL,
  provider_ref  TEXT,                                  -- external provider reference
  idempotency_key TEXT UNIQUE,                         -- 7-day retention
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);

CREATE TABLE wallets (
  user_id       UUID PRIMARY KEY REFERENCES users(id),
  balance       BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency      CHAR(3) NOT NULL,
  locked_balance BIGINT NOT NULL DEFAULT 0,
  version       INT NOT NULL DEFAULT 0,  -- optimistic locking
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Wallet updates MUST use optimistic locking: UPDATE WHERE version = $current_version
```

### Design decisions encoded in schema
- `amount` as BIGINT (cents) not DECIMAL — avoids floating-point representation errors
- `idempotency_key` UNIQUE constraint enforces the invariant at DB level, not just application level
- `version` column on wallets for optimistic locking — prevents double-debit race conditions
- Partial index on payments.status filters only active payments — keeps index small
```

**This should be added to all 108 contracts.** It's a significant but one-time effort — roughly 3–5 hours per contract for the core financial modules, less for simpler ones. The schemas become queryable via a new MCP tool: `get_schema(module, engine)`.

### Addition 2: Distributed system design patterns per module

The contracts have system-level constraints (consistency model, delivery guarantee, multi-region behavior, backpressure). They don't have the concrete distributed system patterns that implement those constraints.

A senior engineer reading `payments` with `consistency: strong` and `delivery: at_least_once` immediately knows: saga pattern for the payment flow, outbox pattern for webhook delivery, optimistic locking on the wallet, idempotency table for deduplication. Blueprint should encode this explicitly.

```markdown
## Distributed System Patterns

### payments

**Saga pattern** (for initiatePayment):
  Step 1: Create payment record (status: pending) — local transaction
  Step 2: Call provider (async, with idempotency key)
  Step 3: On provider success: update status → completed, emit PaymentCompleted event
  Compensation: On step 2 failure: update status → failed, emit PaymentFailed, refund if necessary

**Outbox pattern** (for PaymentCompleted events):
  Write event to outbox table in same transaction as status update
  Separate worker polls outbox and delivers to event bus
  Mark as delivered on success
  Guarantees: event is delivered at least once even if app crashes after DB write

**Idempotency table** (for provider webhook deduplication):
  Table: payment_idempotency_keys (key, result_json, created_at)
  On each webhook: check table first, return cached result if found
  Insert key + result atomically with the state change
  Retain for 7 days (per global standards)

**Optimistic locking** (for wallet operations):
  Read wallet with version N
  Apply change (debit/credit)
  UPDATE wallets SET balance = $new, version = N+1 WHERE user_id = $id AND version = N
  If 0 rows updated: another transaction won the race → retry
  Max 3 retries before returning concurrency_conflict error
```

**The MCP tool for this:** `get_distributed_patterns(module)` — returns the recommended patterns for that module's consistency and delivery requirements.

### Addition 3: Cross-module interaction patterns (sagas)

The current `contracts/core/sagas.md` defines the saga concept. It doesn't define the specific sagas for multi-module flows. A checkout flow involves `cart`, `orders`, `payments`, `inventory`, `notifications`, `audit_log`, `fulfillment`. The dependency graph tells you they're related. It doesn't tell you the sequence, compensation logic, or failure modes.

```markdown
## Proposed: contracts/sagas/checkout.md

# Saga: Checkout

**Modules:** cart → orders → payments → inventory → notifications → fulfillment → audit_log

**Steps:**
1. validate_cart(cart_id) — verify items still available at quoted prices
   Compensation: none (read-only)

2. create_order(cart_id, user_id, address) → Order
   Compensation: cancel_order(order_id)

3. reserve_inventory(order_id, items[]) → ReservationId
   Compensation: release_reservation(reservation_id)

4. initiate_payment(order_id, amount, method, idempotency_key) → Payment
   Compensation: initiate_refund(payment_id, amount, reason: "checkout_failed")

5. confirm_order(order_id) → Order
   Compensation: none (idempotent — order already in confirmed state if we reach this)

6. [async] emit: OrderConfirmed → triggers fulfillment, notification, audit_log in parallel

**Failure modes:**
- Step 3 fails (out of stock): compensate step 2, return item_unavailable error to user
- Step 4 fails (card declined): compensate steps 3, 2, return payment_failed error
- Step 4 timeout: retry with same idempotency_key, do NOT create new payment record
- Step 5 fails after step 4 succeeded: payment is complete, order confirm is a DB write — retry
- Step 6 failures: async, non-blocking — handled by event bus retry, not saga compensation

**Invariants:**
- A payment must never be captured without a corresponding order record
- Inventory must never be deducted for a failed payment
- The saga orchestrator holds the idempotency key — not individual steps
```

**MCP tool:** `get_saga(name)` — returns the full saga spec with steps, compensation, and failure modes.

---


## Part 5 — New MCP Tools Blueprint Needs

The current 7 tools are enough for contract lookup. A software engineering agent needs more.

### Tool 8: `get_schema(module, engine)`

Returns the canonical database schema for a module in the requested engine (postgresql, mysql, mongodb, sqlite).

```typescript
// Addition to src/mcp/server.ts

{
  name: "get_schema",
  description: "Get the canonical database schema for a module",
  inputSchema: {
    type: "object",
    properties: {
      module: { type: "string", description: "Module name" },
      engine: {
        type: "string",
        enum: ["postgresql", "mysql", "mongodb", "sqlite"],
        description: "Database engine",
        default: "postgresql",
      },
    },
    required: ["module"],
  },
},
```

### Tool 9: `get_saga(name)`

Returns the full saga specification for a multi-module flow.

```typescript
{
  name: "get_saga",
  description: "Get the full saga spec for a multi-module business flow (checkout, subscription, onboarding, etc.)",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Saga name (e.g., checkout, subscription_upgrade, user_offboarding)" },
    },
    required: ["name"],
  },
},
```

### Tool 10: `get_distributed_patterns(module)`

Returns the recommended distributed system patterns for a module's consistency and delivery requirements.

```typescript
{
  name: "get_distributed_patterns",
  description: "Get recommended distributed system patterns for a module (saga, outbox, idempotency table, optimistic locking, etc.)",
  inputSchema: {
    type: "object",
    properties: {
      module: { type: "string", description: "Module name" },
    },
    required: ["module"],
  },
},
```

### Tool 11: `validate_implementation(module, code_summary)`

Given a description of what was implemented, check it against the contract invariants and return any violations.

```typescript
{
  name: "validate_implementation",
  description: "Check an implementation description against the module contract invariants. Returns violations if any.",
  inputSchema: {
    type: "object",
    properties: {
      module: { type: "string" },
      code_summary: { type: "string", description: "Description of what was implemented" },
    },
    required: ["module", "code_summary"],
  },
},
```

### Tool 12: `suggest_modules(description)`

Given a plain-English description of what you want to build, suggest which modules to start with and in what order.

```typescript
{
  name: "suggest_modules",
  description: "Given a plain-English description of a feature or system, suggest which Blueprint modules to implement and in what order",
  inputSchema: {
    type: "object",
    properties: {
      description: { type: "string", description: "What you want to build" },
    },
    required: ["description"],
  },
},
```

---


