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
- `available = on_hand - reserved` at all times.
- `updateStockOnHand` must use a database-level `CHECK (on_hand >= 0)` constraint to enforce non-negativity. Application-level check is insufficient under concurrent transactions. Use atomic UPDATE with conditional: `UPDATE inventory_stock SET on_hand = on_hand + $delta WHERE variant_id = $id AND on_hand + $delta >= 0 RETURNING on_hand`. If 0 rows returned: return `insufficient_stock` error.
- `confirmStock` must be idempotent — confirming twice must not double-decrement.
- `reserveStock` must use the optimistic locking pattern: read version N, then `UPDATE inventory_stock SET reserved = reserved + $qty, version = N + 1 WHERE variant_id = $id AND version = N AND available >= $qty`. If 0 rows updated: retry entire operation (max 3). Prevents double-sell under concurrent checkout load.
- Reservations must expire automatically if not confirmed. Expiry is configurable per deployment (default 15 minutes). On expiry, release stock atomically and emit `inventory.stock.released`.
- `adjustStock` delta must not bring `on_hand` below zero unless `reason` is explicitly a correction (e.g. `inventory_count_correction`).

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

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE inventory_stock (
  variant_id  UUID NOT NULL,
  location_id UUID,
  on_hand     BIGINT NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  version     INT NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (variant_id, location_id)
);

CREATE TABLE inventory_reservations (
  token       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id  UUID NOT NULL,
  location_id UUID,
  quantity    INT NOT NULL CHECK (quantity > 0),
  order_id    UUID NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'confirmed', 'released', 'expired')),
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reservations_variant ON inventory_reservations(variant_id, status) WHERE status = 'active';
CREATE INDEX idx_reservations_expiry ON inventory_reservations(expires_at) WHERE status = 'active';

CREATE TABLE inventory_adjustments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id  UUID NOT NULL,
  delta       BIGINT NOT NULL,
  on_hand_before BIGINT NOT NULL,
  on_hand_after  BIGINT NOT NULL,
  reason      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Distributed System Patterns

**Optimistic locking (stock level updates):**
* Read stock level with version N
* UPDATE inventory_stock SET on_hand = on_hand + $delta, version = N+1 WHERE variant_id = $id AND version = N
* If 0 rows updated: retry entire operation (max 3)
* Prevents double-sell under concurrent checkout load

**Scheduled expiry (reservation cleanup):**
* Background worker queries inventory_reservations WHERE status = 'active' AND expires_at < now()
* For each expired reservation: release stock, emit inventory.stock.released event
* Idempotent -- double-expiry is a no-op

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `inventory.<function>`.
* **Telemetry Metrics:**
```
gensense_inventory_reservations_active       gauge { variant_id? }
  gensense_inventory_stock_level               gauge { variant_id, location_id? }
  gensense_inventory_reservation_expiry_total  counter { reason: expired|confirmed|released }
```
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
* **Depends On:** catalog (for variant existence validation)
* **Emits To:** events
* **Recommends:** caching (for stock level reads), queues (for expiry processing)
