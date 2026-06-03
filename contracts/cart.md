# Module Contract: `cart`

**Version:** 0.1.0

---

### `cart`
Session-based shopping cart.

**Functions**
```
getCart(cart_id) → Cart
createCart(user_id?) → Cart
addToCart(cart_id, variant_id, quantity) → CartItem
updateCartItem(cart_id, item_id, quantity) → CartItem
removeCartItem(cart_id, item_id) → void
clearCart(cart_id) → void
applyCoupon(cart_id, code) → Cart
removeCoupon(cart_id) → Cart
getCartTotal(cart_id, context?) → CartTotal
mergeCart(anonymous_cart_id, user_cart_id) → Cart
```

**Types**
```
Cart { id, user_id?, items, coupon?, expires_at }
CartItem { id, variant_id, quantity, unit_price, total_price }
CartTotal { subtotal, discount, tax, shipping?, total, currency }
```

**Invariants**
- Adding an item that already exists must increment quantity, not create a duplicate
- `getCartTotal` must reflect current prices, not prices at time of add-to-cart

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `read_your_writes`
* **Details:** Cart owner always sees their own updates; other processes may lag briefly

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
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `cart.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** catalog, inventory, promotions
* **Emits To:** events
* **Recommends:** caching (for cart state)
