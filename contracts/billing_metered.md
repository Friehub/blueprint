# Module Contract: `billing_metered`

**Version:** 0.1.0

---

### `billing_metered`
Usage-based billing for metered resources (API calls, storage, compute, seats). Tracks consumption, aggregates into billable units, and coordinates with `billing` for invoice generation.

**Functions**
```
recordUsage(usage) → UsageRecord
getUsage(user_id, metric, period) → AggregatedUsage
getBillableUsage(user_id, period) → BillableUsage[]
createMeteredPlan(name, metrics, pricing) → MeteredPlan
updateMeteredPlan(plan_id, changes) → MeteredPlan
listMeteredPlans() → MeteredPlan[]
getUsageAlerts(user_id) → UsageAlert[]
setUsageAlert(user_id, metric, threshold) → UsageAlert
```

**Types**
```
UsageRecord { id, user_id, metric, value, timestamp, metadata? }
AggregatedUsage { user_id, metric, period_start, period_end, total, unit }
BillableUsage { user_id, metric, quantity, price_per_unit, total_amount, currency }
MeteredPlan { id, name, metrics: MeteredMetric[], billing_frequency, currency }
MeteredMetric { key, unit, price_tiers: PriceTier[], aggregation: sum|max|last }
PriceTier { from, to?, unit_price, flat_fee? }
UsageAlert { id, user_id, metric, threshold, type: percentage|absolute, triggered, created_at }
```

**Invariants**
- `recordUsage` must be idempotent on `(user_id, metric, timestamp, idempotency_key)` — duplicate recording of the same usage at the same timestamp must not double-count
- Usage timestamps must be in UTC; the module rejects non-UTC timestamps with `INVALID_TIMEZONE`
- Aggregation windows are calendar-aligned per the plan's `billing_frequency` (daily, monthly, or billing-period); partial periods are prorated
- Price tier thresholds are evaluated in ascending order; the first matching tier determines the price for the quantity bracket
- A `MeteredPlan` with no metrics defined must be rejected at creation time
- Usage older than the plan's billing period + 48 hours is rejected as outside the recording window

**Providers:** Stripe Metered Billing, Metronome, Lago, Orb, Chargebee

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual` (usage recording), `strong` (aggregation queries)
* **Details:** Raw usage records accept eventual consistency; billable aggregations must be strongly consistent at read time.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for usage recording.
* **Details:** Duplicate usage records must be deduplicated by idempotency key.

### Worker Scaling
* **Policy:** Usage ingestion, aggregation, and alert evaluation must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether usage recording is single-region or active/passive.
* **Details:** Cross-region duplicates must be deduplicated by idempotency key.

### Idempotency Requirements
* **Standard:** Idempotency keys accepted on `recordUsage` and retained for 48 hours past the billing period end.
* **Required Functions:**
  - `recordUsage(usage, idempotency_key?)`

### Backpressure
* If usage ingestion is saturated, records must be queued or rejected predictably rather than silently dropped. Ingestion lag must be surfaced in observability.

### Error Taxonomy
### Module-Specific Errors
```
recordUsage:
    outside_recording_window:   Usage timestamp is too old | reject
    invalid_timezone:           Timestamp is not UTC | reject
    duplicate_usage:            Idempotency key match found | return existing record
    metric_not_found:           Metric key not in plan | reject

  getBillableUsage:
    billing_period_not_closed:  Period has not ended yet | return partial data with warning
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
recordUsage        → billing_metered.usage.recorded    { user_id, metric, value, timestamp }
aggregation_ready  → billing_metered.usage.aggregated  { user_id, metric, period, total }
alert_triggered    → billing_metered.alert.triggered   { user_id, metric, threshold, current_value }
```

### Temporal Constraints
```
Usage recording window:
    max_lag:           48 hours past the billing period end
    on_expiry:         reject with outside_recording_window

  Aggregation schedule:
    daily:             runs at 00:15 UTC
    monthly:           runs at 00:15 UTC on the 1st
```

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE metered_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  metrics           JSONB NOT NULL,
  billing_frequency TEXT NOT NULL CHECK (billing_frequency IN ('monthly', 'daily')),
  currency          CHAR(3) NOT NULL,
  active            BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE metered_usage (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  metric      TEXT NOT NULL,
  value       NUMERIC(20,4) NOT NULL CHECK (value >= 0),
  recorded_at TIMESTAMPTZ NOT NULL,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_metered_usage_lookup ON metered_usage(user_id, metric, recorded_at);
CREATE UNIQUE INDEX idx_metered_usage_idempotency ON metered_usage(user_id, metric, recorded_at)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE metered_aggregations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  metric        TEXT NOT NULL,
  period_start  TIMESTAMPTZ NOT NULL,
  period_end    TIMESTAMPTZ NOT NULL,
  total         NUMERIC(20,4) NOT NULL DEFAULT 0,
  unit          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_metered_agg_unique ON metered_aggregations(user_id, metric, period_start, period_end);

CREATE TABLE metered_alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  metric      TEXT NOT NULL,
  threshold   NUMERIC(20,4) NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('percentage', 'absolute')),
  triggered   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_metered_alerts_user ON metered_alerts(user_id);
```

### Distributed System Patterns

**Outbox pattern (usage recording):**
- Usage records are written to an outbox table in the same transaction as the raw usage insert
- A dispatcher reads the outbox and publishes to the event bus for aggregation pipeline

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `billing_metered.<function>`.
* **Telemetry Metrics:**
```
gensense_billing_metered_usage_recorded_total     { metric }
gensense_billing_metered_aggregation_total        { metric }
gensense_billing_metered_ingestion_lag_seconds    histogram { metric }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** billing, users
* **Emits To:** events
* **Recommends:** queues (for async aggregation), notifications (for usage alerts)

### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return provider_error, do not retry indefinitely |
| Ingestion queue saturated | Buffer to secondary queue; surface lag in observability |
| Aggregation query timeout | Return partial results with warning; retry as background job |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise
