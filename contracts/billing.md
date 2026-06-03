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

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `billing.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** payments, users
* **Emits To:** events
* **Recommends:** notifications, audit_log, usage_metering
