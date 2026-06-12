# Module Contract: `billing_proration`

**Version:** 0.1.0

---

### `billing_proration`
Mid-cycle plan change credit and charge calculation. Computes prorated amounts when a subscription changes plan before the billing period ends.

**Functions**
```
calculateProration(user_id, from_plan_id, to_plan_id, effective_at) → ProrationResult
applyProration(proration_id) → ProrationCredit
getProration(proration_id) → ProrationCredit
listProrations(user_id, options?) → PaginatedResult<ProrationCredit>
voidProration(proration_id, reason) → void
getProrationPolicy(plan_id) → ProrationPolicy
setProrationPolicy(plan_id, policy) → void
```

**Types**
```
ProrationResult { id, user_id, from_plan_id, to_plan_id, effective_at, days_remaining, total_days, credit_amount, charge_amount, net_amount, currency }
ProrationCredit { id, user_id, proration_id, type: credit|charge, amount, currency, status, applied_at?, created_at }
ProrationPolicy { type: prorate_full | prorate_credit_only | prorate_charge_only | no_proration, credit_expiry_days?, minimum_credit? }
ProrationStatus = pending | applied | voided | expired
```

**Invariants**
- `calculateProration` must compute the exact ratio of remaining days in the current billing period: `credit = (remaining_days / total_days) * period_price`. The remaining days count excludes the effective date (the new plan starts on the effective date).
- `applyProration` is idempotent — applying the same proration twice must not double-credit or double-charge
- Proration is always calculated from the current plan's billing period, not from the subscription start date
- A proration with `net_amount = 0` (credit equals charge exactly) must still be recorded as a zero-value adjustment for audit purposes
- Credits expire according to the policy's `credit_expiry_days`; expired credits are reversed and recorded in audit_log
- `voidProration` is only valid for prorations in `pending` or `applied` status; voiding an already-expired proration is a no-op

**Providers:** custom, Stripe proration engine, Recurly, Chargebee

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Proration calculations must reflect the exact billing period state at the time of calculation.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for proration lifecycle events.
* **Details:** Duplicate proration calculation requests with the same parameters must return the existing result.

### Worker Scaling
* **Policy:** Proration calculation and credit expiry processing are low-volume; no special scaling required.

### Multi-Region Behavior
* **Mode:** Prorations are single-region due to strong consistency requirement on billing period state.
* **Details:** Cross-region credit reconciliation must be handled by the billing module.

### Idempotency Requirements
* **Standard:** Idempotency keys accepted on `calculateProration` and `applyProration` and retained for 7 days.
* **Required Functions:**
  - `calculateProration(user_id, from_plan_id, to_plan_id, effective_at, idempotency_key?)`
  - `applyProration(proration_id, idempotency_key?)`

### Backpressure
* Proration calculations are synchronous and low-latency; no backpressure mechanism needed.

### Error Taxonomy
### Module-Specific Errors
```
calculateProration:
    plan_not_found:            from_plan_id or to_plan_id does not exist | return 404
    proration_exists:          An identical proration was already calculated | return existing result
    policy_not_found:          No proration policy defined for the plan | use no_proration default

  applyProration:
    preration_not_found:       proration_id does not exist | return 404
    proration_already_applied: Proration credit/charge already applied | return existing credit
    proration_expired:         Credit window has elapsed | return expired error
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
calculateProration  → billing_proration.calculated       { user_id, from_plan, to_plan, net_amount }
applyProration      → billing_proration.applied          { proration_id, type, amount }
voidProration       → billing_proration.voided           { proration_id, reason }
credit_expired      → billing_proration.credit.expired   { proration_id, amount }
```

### Temporal Constraints
```
Proration credit expiry:
    default:        90 days (configurable per policy)
    on_expiry:      reverse credit, record in audit_log

  Calculation precision:
    days:           uses calendar days, not business days
    rounding:       round down to minor currency unit (e.g. cents), remainder carried forward
```

### Database Schema

#### PostgreSQL
```sql
CREATE TYPE proration_type AS ENUM ('credit', 'charge');
CREATE TYPE proration_status AS ENUM ('pending', 'applied', 'voided', 'expired');

CREATE TABLE proration_policies (
  plan_id             UUID PRIMARY KEY,
  type                TEXT NOT NULL DEFAULT 'prorate_full'
                        CHECK (type IN ('prorate_full', 'prorate_credit_only', 'prorate_charge_only', 'no_proration')),
  credit_expiry_days  INT,
  minimum_credit      BIGINT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE prorations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL,
  subscription_id   UUID NOT NULL,
  from_plan_id      UUID NOT NULL,
  to_plan_id        UUID NOT NULL,
  effective_at      TIMESTAMPTZ NOT NULL,
  days_remaining    INT NOT NULL,
  total_days        INT NOT NULL,
  credit_amount     BIGINT NOT NULL DEFAULT 0,
  charge_amount     BIGINT NOT NULL DEFAULT 0,
  net_amount        BIGINT NOT NULL,
  currency          CHAR(3) NOT NULL,
  idempotency_key   TEXT UNIQUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prorations_user ON prorations(user_id, created_at DESC);
CREATE INDEX idx_prorations_subscription ON prorations(subscription_id);

CREATE TABLE proration_credits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proration_id    UUID NOT NULL REFERENCES prorations(id),
  user_id         UUID NOT NULL,
  type            proration_type NOT NULL,
  amount          BIGINT NOT NULL CHECK (amount > 0),
  currency        CHAR(3) NOT NULL,
  status          proration_status NOT NULL DEFAULT 'pending',
  expires_at      TIMESTAMPTZ,
  applied_at      TIMESTAMPTZ,
  voided_at       TIMESTAMPTZ,
  void_reason     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_proration_credits_status ON proration_credits(status, expires_at) WHERE status = 'applied';
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `billing_proration.<function>`.
* **Telemetry Metrics:**
```
gensense_billing_proration_calculated_total      { from_plan, to_plan }
gensense_billing_proration_credits_issued_total
gensense_billing_proration_credits_expired_total
gensense_billing_proration_net_revenue_impact     gauge { currency }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** billing, subscriptions
* **Emits To:** events
* **Recommends:** audit_log, notifications

### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return provider_error, do not retry indefinitely |
| Billing period state stale | Re-read subscription before calculation; retry once |
| Plan not found in catalog | Return plan_not_found error |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise
