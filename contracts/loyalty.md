# Module Contract: `loyalty`

**Version:** 0.1.0

---

### `loyalty` (Retail, Hospitality)
Points, rewards, and loyalty tier management.

**Functions**
```
getBalance(user_id) → LoyaltyBalance
earnPoints(user_id, amount, reason, reference) → LoyaltyTransaction
redeemPoints(user_id, amount, reference) → LoyaltyTransaction
getTransactions(user_id, options?) → PaginatedResult<LoyaltyTransaction>
getTier(user_id) → LoyaltyTier
calculateTierProgress(user_id) → TierProgress
getRewards(tier?) → Reward[]
redeemReward(user_id, reward_id) → RewardRedemption
```

**Types**
```
LoyaltyBalance { user_id, points, lifetime_points, tier, expiring_soon? }
LoyaltyTier { name, minimum_points, multiplier, benefits }
LoyaltyTransaction { id, type: earn|redeem|expire|adjust, amount, balance_after, reference }
TierProgress { current_tier, next_tier?, points_needed? }
```

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Standard transactional consistency

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for point ledger events.
* **Details:** Duplicate earn/redeem retries must not duplicate point balances.

### Worker Scaling
* **Policy:** Earning, redemption, and tier calculation workloads must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether loyalty state is single-region or active/passive.
* **Details:** Cross-region point updates must converge deterministically.

### Idempotency Requirements
* **Standard:** All state-mutating functions accept an optional `idempotency_key: string` parameter. Keys must be retained for at least 24 hours.
* **Required Functions:**
  - `earnPoints(user_id, amount, reason, reference, idempotency_key?)`
  - `redeemPoints(user_id, amount, reference, idempotency_key?)`

### Backpressure
* If points processing is saturated, point changes must defer or reject predictably rather than becoming inconsistent.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
earnPoints           → loyalty.points.earned           { user_id, amount, balance_after, reason }
redeemPoints         → loyalty.points.redeemed          { user_id, amount, balance_after, reference }
points_expire        → loyalty.points.expired           { user_id, amount, reason }
tier_change          → loyalty.tier.changed             { user_id, from_tier, to_tier }
redeemReward         → loyalty.reward.redeemed           { user_id, reward_id, cost_points, status }
```

### Temporal Constraints
```
Points expiry:
    expiration:        configurable per program
    on_expiry:         expire points and record transaction
```

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE loyalty_tiers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  minimum_points  BIGINT NOT NULL DEFAULT 0,
  multiplier      NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  benefits        JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE loyalty_balances (
  user_id         UUID PRIMARY KEY,
  points          BIGINT NOT NULL DEFAULT 0 CHECK (points >= 0),
  lifetime_points BIGINT NOT NULL DEFAULT 0,
  tier_id         UUID REFERENCES loyalty_tiers(id),
  version         INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE loyalty_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('earn', 'redeem', 'expire', 'adjust')),
  amount          BIGINT NOT NULL,
  balance_before  BIGINT NOT NULL,
  balance_after   BIGINT NOT NULL,
  reference       TEXT,
  reason          TEXT,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_loyalty_tx_user ON loyalty_transactions(user_id, created_at DESC);
CREATE UNIQUE INDEX idx_loyalty_tx_reference ON loyalty_transactions(user_id, reference) WHERE reference IS NOT NULL;

CREATE TABLE loyalty_rewards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id         UUID REFERENCES loyalty_tiers(id),
  name            TEXT NOT NULL,
  description     TEXT,
  cost_points     BIGINT NOT NULL CHECK (cost_points > 0),
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE loyalty_redemptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  reward_id       UUID NOT NULL REFERENCES loyalty_rewards(id),
  cost_points     BIGINT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  fulfilled_at    TIMESTAMPTZ
);

CREATE INDEX idx_loyalty_redemptions_user ON loyalty_redemptions(user_id, created_at DESC);
```

### Storage Model
* **Model:** Durable loyalty ledger.
* **Details:** Balance history must be append-only and queryable for the configured retention window.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `loyalty.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return provider_error, do not retry indefinitely |
| Provider rate limited | Respect Retry-After header, apply exponential backoff |
| Partial success in batch | Return partial_success with succeeded[] and failed[] |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise

### Module Dependencies
* **Depends On:** users, orders (to trigger point earning)
* **Emits To:** events
* **Recommends:** notifications, audit_log
