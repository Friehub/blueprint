# Module Contract: `promotions`

**Version:** 0.1.0

---

### `promotions`
Discount and promotion engine.
This module also owns gift cards as stored-value promotional instruments.

**Functions**
```
validateCoupon(code, cart_id, user_id?) → CouponValidation
markCouponUsed(code, order_id, user_id) → void
getActiveFlashSales() → FlashSale[]
getFlashSaleForVariant(variant_id) → FlashSale?
applyPromotionToCart(cart_id, promotion_id) → Cart
getEligiblePromotions(cart_id, user_id?) → Promotion[]
createPromotion(data) → Promotion
archivePromotion(promotion_id) → void
issueGiftCard(data) → GiftCard
getGiftCard(code) → GiftCard
listGiftCards(input, options?) → PaginatedResult<GiftCard>
redeemGiftCard(code, order_id, amount) → GiftCardRedemption
voidGiftCard(code, reason) → GiftCard
```

**Types**
```
Promotion { id, type, value, conditions, start_at, end_at, usage_limit? }
Coupon { code, promotion_id, used_count, usage_limit? }
FlashSale { variant_id, sale_price, start_at, end_at, stock_limit? }
CouponValidation { valid, discount_amount?, reason? }
PromotionType = percentage | fixed_amount | free_shipping | buy_x_get_y
GiftCard { code, balance, currency, status, issued_at, expires_at?, redeemed_at? }
GiftCardRedemption { id, code, order_id, amount, currency, created_at }
GiftCardStatus = active | partially_redeemed | redeemed | void | expired
```

**Invariants**
- `validateCoupon` must not mark the coupon as used -- that is `markCouponUsed`'s job
- `markCouponUsed` must be idempotent for the same `(code, order_id)` pair; a second call with the same pair must not increment `used_count`
- Gift card redemptions must not exceed available balance -- the database must enforce `balance >= 0` via CHECK constraint
- Gift card redemption must be idempotent for the same `(code, order_id, amount)` tuple
- Coupon codes and gift card codes must be unique within their respective tables -- enforced via UNIQUE constraint
- A promotion's `end_at` must be in the future at the time of creation -- enforced at the application layer
- `applyPromotionToCart` must reject a promotion that has reached its `usage_limit`
- A flash sale's `sale_price` must be less than the catalog variant's current price -- validated at creation

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Coupon usage counts, gift card balances, and flash sale stock must be updated atomically. A decrement of a coupon's remaining uses must be in the same transaction as the order placement.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for promotion lifecycle and gift card events.
* **Details:** Duplicate events from promotion creation or gift card issuance must be idempotent (same event ID yields no-op on replay).

### Worker Scaling
* **Policy:** Coupon validation, flash sale queries, and gift card operations must be independently scalable.
* **Details:** Flash sale endpoints must be read-replica scalable with a short cache TTL to handle traffic spikes.

### Multi-Region Behavior
* **Mode:** Promotion definitions are global; coupon usage and gift card balances are per-region with async reconciliation.
* **Details:** Flash sale start times must be declared in UTC and must be consistent across all regions. Gift card balance updates must converge globally within 5 seconds.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* Flash sale traffic spikes must be absorbed by read replicas and caching; write operations (coupon mark, gift card redeem) must be queued if the primary database is saturated rather than rejected outright.
* `validateCoupon` should prefer cache lookups and fall back to the primary store only for confirmation.

### Algorithm
* **Recommended:** Validation-first ordering for coupon application: validate coupon → check usage limits → apply discount → mark used in a single transaction. FIFO for gift card redemption to ensure fairness under concurrent access.
* **Tradeoff:** Strict FIFO on gift card redemption adds latency; a lock-free balance check with optimistic concurrency control is acceptable when conflict probability is low (<1%).
* **Atomicity:** `markCouponUsed` and `redeemGiftCard` must be atomic with the order placement transaction. Partial application (coupon marked used but order not placed) must roll back.

### Storage Model
* **Model:** Relational database (PostgreSQL) for promotions, coupons, flash sales, and gift cards.
* **Details:**
```sql
CREATE TABLE promotions (
    id              UUID PRIMARY KEY,
    type            TEXT NOT NULL CHECK (type IN ('percentage', 'fixed_amount', 'free_shipping', 'buy_x_get_y')),
    value           NUMERIC(10,2) NOT NULL CHECK (value > 0),
    conditions      JSONB,
    start_at        TIMESTAMPTZ NOT NULL,
    end_at          TIMESTAMPTZ NOT NULL CHECK (end_at > start_at),
    usage_limit     INT CHECK (usage_limit IS NULL OR usage_limit > 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE coupons (
    code            TEXT PRIMARY KEY,
    promotion_id    UUID NOT NULL REFERENCES promotions(id),
    used_count      INT NOT NULL DEFAULT 0 CHECK (used_count >= 0),
    usage_limit     INT CHECK (usage_limit IS NULL OR usage_limit > 0)
);

CREATE TABLE flash_sales (
    id              UUID PRIMARY KEY,
    variant_id      UUID NOT NULL,
    sale_price      NUMERIC(10,2) NOT NULL CHECK (sale_price > 0),
    start_at        TIMESTAMPTZ NOT NULL,
    end_at          TIMESTAMPTZ NOT NULL CHECK (end_at > start_at),
    stock_limit     INT CHECK (stock_limit IS NULL OR stock_limit > 0),
    UNIQUE (variant_id, start_at)
);

CREATE TABLE gift_cards (
    code            TEXT PRIMARY KEY,
    balance         NUMERIC(10,2) NOT NULL CHECK (balance >= 0),
    currency        TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'partially_redeemed', 'redeemed', 'void', 'expired')),
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ,
    redeemed_at     TIMESTAMPTZ
);

CREATE TABLE gift_card_redemptions (
    id              UUID PRIMARY KEY,
    code            TEXT NOT NULL REFERENCES gift_cards(code),
    order_id        UUID NOT NULL,
    amount          NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    currency        TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (code, order_id, amount)
);
```

### Error Taxonomy
### Module-Specific Errors
```
validateCoupon:
    coupon_not_found:          Coupon code does not exist | verify code
    coupon_expired:            Coupon has passed its validity period | check start/end dates
    coupon_usage_exhausted:    Coupon has reached its usage limit | inform user
    coupon_invalid_for_cart:   Coupon conditions not met by cart contents | check conditions

  markCouponUsed:
    coupon_already_used:       Coupon already applied to this order | return existing result (idempotent)

  applyPromotionToCart:
    promotion_not_eligible:    Promotion conditions not met by cart | check promotion conditions
    promotion_expired:         Promotion period has ended | inform user

  issueGiftCard:
    gift_card_creation_failed: Could not issue gift card | retry or check balance configuration

  redeemGiftCard:
    gift_card_expired:         Gift card has passed its expiry date | inform user
    gift_card_void:            Gift card has been voided | inform user
    insufficient_balance:      Gift card balance is less than requested amount | suggest partial redemption

  voidGiftCard:
    gift_card_already_void:    Gift card is already voided | return existing state (idempotent)
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createPromotion     → promotions.promotion.created          { promotion_id, type, value }
archivePromotion    → promotions.promotion.archived         { promotion_id }

validateCoupon      → promotions.coupon.validated           { code, valid, reason? }
markCouponUsed      → promotions.coupon.used                { code, order_id }

issueGiftCard       → promotions.gift_card.issued           { code, balance, currency }
redeemGiftCard      → promotions.gift_card.redeemed         { code, order_id, amount }
voidGiftCard        → promotions.gift_card.voided           { code, reason }

getActiveFlashSales → promotions.flash_sale.queried         { variant_ids }
```

### Temporal Constraints
```
Coupon validity:
    duration:       defined by promotion start/end dates
    on_expiry:      validateCoupon returns coupon_expired; markCouponUsed rejected

  Flash sale:
    duration:       start_at to end_at per flash_sale record
    on_expiry:      removed from getActiveFlashSales results

  Gift card:
    default:        24 months from issuance unless expires_at specified
    on_expiry:      status transitions to expired; redeemGiftCard returns gift_card_expired

  Usage limit reset:
    N/A:            usage limits are cumulative over the lifetime of the promotion
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `promotions.<function>`.
* **Telemetry Metrics:**
```
blueprint_promotions_coupon_validations_total       { result }
blueprint_promotions_coupon_redemptions_total       { code }
blueprint_promotions_gift_card_balance_total         gauge { currency }
blueprint_promotions_flash_sale_active_count         gauge
blueprint_promotions_operation_duration_ms           histogram { function }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details). Flash sale lookup P99 must be < 50ms.

### Module Dependencies
* **Depends On:** catalog, orders
* **Emits To:** events
* **Recommends:** caching (for active flash sale lookup), audit_log
