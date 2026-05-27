# Module Contract: `loyalty`

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
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
```
Points expiry:
    expiration:        configurable per program
    on_expiry:         expire points and record transaction
```

### Storage Model
* **Model:** Durable loyalty ledger.
* **Details:** Balance history must be append-only and queryable for the configured retention window.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `loyalty.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** users, orders (to trigger point earning)
* **Emits To:** events
* **Recommends:** notifications, audit_log
