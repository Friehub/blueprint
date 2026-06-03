# Module Contract: `inventory`

**Version:** 0.1.0

---

### `inventory`
Stock tracking with reservation lifecycle.

**Functions**
```
getStockLevel(variant_id, location_id?) → StockLevel
getStockLevels(variant_ids) → StockLevel[]
reserveStock(variant_id, quantity, order_id) → StockReservation
releaseStock(reservation_token) → void
confirmStock(reservation_token) → void
updateStockOnHand(variant_id, quantity, location_id?) → void
adjustStock(variant_id, delta, reason) → StockAdjustment
getStockHistory(variant_id) → StockAdjustment[]
getLowStockAlerts(threshold?) → StockLevel[]
```

**Types**
```
StockLevel { variant_id, on_hand, reserved, available, location_id? }
StockReservation { token, variant_id, quantity, expires_at }
ReservationToken = string (opaque)
StockAdjustment { id, variant_id, delta, reason, created_at }
```

**Invariants**
- `available = on_hand - reserved` at all times
- `confirmStock` must be idempotent -- confirming twice must not double-decrement
- Reservations must expire automatically if not confirmed

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** `available = on_hand - reserved` must hold at all times

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for stock reservation and expiry events.
* **Details:** Duplicate stock actions must be idempotent.

### Worker Scaling
* **Policy:** Reservation, confirmation, and stock alert workloads must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether inventory is single-region or active/passive.
* **Details:** Concurrent cross-region writes must not violate stock invariants.

### Idempotency Requirements
* **Standard:** All state-mutating functions accept an optional `idempotency_key: string` parameter. Keys must be retained for at least 24 hours.
* **Required Functions:**
  - `reserveStock(variant_id, quantity, order_id, idempotency_key?)`
  - `confirmStock(reservation_token, idempotency_key?)`
  - `adjustStock(variant_id, delta, reason, idempotency_key?)`

### Backpressure
* If reservation throughput is saturated, stock reservations must be queued or rejected predictably rather than over-committing inventory.

### Error Taxonomy
### Module-Specific Errors
```
reserveStock:
    insufficient_stock:        Available quantity less than requested | return available quantity
    variant_discontinued:      Variant no longer available | suggest alternatives
    reservation_limit_exceeded: Too many open reservations for this variant | retry after expiry window

  confirmStock:
    reservation_expired:       Token TTL has passed | create new reservation or cancel order
    reservation_not_found:     Token does not exist or already confirmed | check idempotency
    quantity_mismatch:         Confirmation quantity differs from reservation | reject

  releaseStock:
    reservation_already_released: Token already released | no-op (idempotent)
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
reserveStock      → inventory.stock.reserved   { token, variant_id, quantity, order_id, expires_at }
  releaseStock      → inventory.stock.released   { token, variant_id, quantity, reason: expired|cancelled }
  confirmStock      → inventory.stock.confirmed  { token, variant_id, quantity }
  adjustStock       → inventory.stock.adjusted   { variant_id, delta, on_hand_after, reason }
  getLowStockAlerts → inventory.stock.low        { variant_id, available, threshold }
```

### Temporal Constraints
```
Reservation expiry:
    max_duration:      configurable per deployment
    on_expiry:         release stock automatically
```

### Storage Model
* **Model:** Strongly consistent inventory store.
* **Details:** Reservation state must be durable; low-stock alert reads may be served from a replica if the invariant remains intact.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `inventory.<function>`.
* **Telemetry Metrics:**
```
gensense_inventory_reservations_active       gauge { variant_id? }
  gensense_inventory_stock_level               gauge { variant_id, location_id? }
  gensense_inventory_reservation_expiry_total  counter { reason: expired|confirmed|released }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** catalog (for variant existence validation)
* **Emits To:** events
* **Recommends:** caching (for stock level reads), queues (for expiry processing)
