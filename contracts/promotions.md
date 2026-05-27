# Module Contract: `promotions`

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
- `markCouponUsed` must be idempotent for the same `(code, order_id)` pair
- Gift card redemptions must not exceed available balance.
- Gift card redemption must be idempotent for the same `(code, order_id, amount)` tuple.

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Standard transactional consistency

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
* None explicitly defined.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `promotions.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** catalog
* **Emits To:** events
* **Recommends:** caching (for active flash sale lookup)
