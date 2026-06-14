# Module Contract: `billing`

**Version:** 0.1.0

---

### `billing`
Subscription and plan management.

**Functions**
```
createSubscription(user_id, plan_id, payment_method) → Subscription
getSubscription(user_id) → Subscription?
upgradeSubscription(user_id, plan_id) → Subscription
downgradeSubscription(user_id, plan_id, at_period_end?) → Subscription
cancelSubscription(user_id, at_period_end?) → Subscription
reactivateSubscription(user_id) → Subscription
getInvoices(user_id, options?) → PaginatedResult<Invoice>
getInvoice(invoice_id) → Invoice
getPlans() → Plan[]
getPlan(plan_id) → Plan
```

**Types**
```
Subscription { id, user_id, plan_id, status, current_period_start, current_period_end, cancel_at? }
Plan { id, name, price, currency, interval, features, limits }
Invoice { id, user_id, amount, currency, status, line_items, due_at, paid_at? }
SubscriptionStatus = active | trialing | past_due | cancelled | paused
```

**Providers:** Stripe, Paddle, Lemonsqueezy, custom

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Subscription status must reflect cancellation immediately

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for subscription lifecycle events.
* **Details:** Duplicate plan changes or cancellation retries must not create duplicate billing state transitions.

### Worker Scaling
* **Policy:** Subscription mutations and invoice queries must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether billing is single-region or active/passive.
* **Details:** Cross-region subscription updates must converge deterministically.

### Idempotency Requirements
* **Standard:** All state-mutating functions accept an optional `idempotency_key: string` parameter. Keys must be retained for at least 24 hours.
* **Required Functions:**
  - `createSubscription(user_id, plan_id, payment_method, idempotency_key?)`
  - `cancelSubscription(user_id, at_period_end?, idempotency_key?)`

### Backpressure
* If payment or billing provider capacity is saturated, subscription changes must defer or reject predictably rather than leaving mixed state.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Temporal Constraints
```
Invoice retention:
    retention:         configurable per finance policy
    on_expiry:         archive or purge according to compliance rules
```

### Storage Model
* **Model:** Durable subscription and invoicing store.
* **Details:** Billing state must be auditable and retained per finance/compliance policy.

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createSubscription    → subscription.created     { user_id, plan_id, trial_ends_at? }
  cancelSubscription    → subscription.cancelled   { user_id, plan_id, cancel_at }
  upgradeSubscription   → subscription.upgraded    { user_id, from_plan, to_plan }
  downgradeSubscription → subscription.downgraded  { user_id, from_plan, to_plan, effective_at }
```

### Temporal Constraints
* None explicitly defined.

### Database Schema

#### PostgreSQL
```sql
CREATE TYPE subscription_status AS ENUM ('active', 'trialing', 'past_due', 'cancelled', 'paused');
CREATE TYPE invoice_status AS ENUM ('draft', 'pending', 'paid', 'overdue', 'cancelled', 'refunded');

CREATE TABLE subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL,
  plan_id             UUID NOT NULL,
  status              subscription_status NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end   TIMESTAMPTZ NOT NULL,
  cancel_at           TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  trial_end           TIMESTAMPTZ,
  idempotency_key     TEXT UNIQUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status) WHERE status IN ('active', 'past_due');

CREATE TABLE invoices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  amount      BIGINT NOT NULL CHECK (amount > 0),
  currency    CHAR(3) NOT NULL,
  status      invoice_status NOT NULL DEFAULT 'draft',
  due_at      TIMESTAMPTZ NOT NULL,
  paid_at     TIMESTAMPTZ,
  line_items  JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_user ON invoices(user_id, created_at DESC);
CREATE INDEX idx_invoices_due ON invoices(due_at) WHERE status IN ('pending', 'overdue');

CREATE TABLE plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  price       BIGINT NOT NULL CHECK (price >= 0),
  currency    CHAR(3) NOT NULL,
  interval    TEXT NOT NULL CHECK (interval IN ('month', 'year', 'week', 'day')),
  features    JSONB NOT NULL DEFAULT '{}',
  limits      JSONB NOT NULL DEFAULT '{}',
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Distributed System Patterns

**Saga pattern (createSubscription):**
* Step 1: Validate payment method via payments module
* Step 2: Create subscription record (status: trialing or active)
* Step 3: Create first invoice (status: pending) if not trialing
* Step 4: Charge payment method via payments.initiatePayment
* Compensation on step 4 failure: mark invoice as failed, cancel subscription

**Outbox pattern (subscription lifecycle events):**
* Subscription state transitions write to outbox in same transaction
* Worker delivers events to downstream billing, notifications, entitlements

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `billing.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`blueprint_<module>_operation_total`, `blueprint_<module>_operation_duration_ms`, `blueprint_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** payments, users
* **Emits To:** events
* **Recommends:** notifications, audit_log, usage_metering
