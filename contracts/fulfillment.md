# Module Contract: `fulfillment`

**Version:** 0.2.1

---

### `fulfillment`
Order fulfillment orchestration across warehouse, packing, shipping, and delivery milestones.

**Functions**
```
createFulfillment(order_id, warehouse_id?) → Fulfillment
getFulfillment(fulfillment_id) → Fulfillment
listFulfillments(input, options?) → PaginatedResult<Fulfillment>
assignWarehouse(fulfillment_id, warehouse_id) → Fulfillment
markPacked(fulfillment_id, metadata?) → Fulfillment
markShipped(fulfillment_id, tracking_number, carrier?) → Fulfillment
markDelivered(fulfillment_id, delivered_at?) → Fulfillment
cancelFulfillment(fulfillment_id, reason) → Fulfillment
```

**Types**
```
Fulfillment { id, order_id, warehouse_id?, status, tracking_number?, carrier?, created_at, packed_at?, shipped_at?, delivered_at?, cancelled_at? }
FulfillmentStatus = pending | allocated | packed | shipped | delivered | cancelled | exception
```

**Invariants**
- A shipped fulfillment cannot be cancelled -- `cancelFulfillment` on a shipped fulfillment must return `FULFILLMENT_ALREADY_SHIPPED`
- Fulfillment state must follow the declared progression: `pending → allocated → packed → shipped → delivered`. Skipping a state is a contract violation
- Tracking details cannot be attached before the shipment state exists -- `markShipped` must be called before tracking is available
- `createFulfillment` must be idempotent on `order_id` -- creating a fulfillment for an already-fulfilled order must return the existing fulfillment
- `markDelivered` must not be called on a cancelled fulfillment -- return `FULFILLMENT_CANCELLED`

**Providers:** custom WMS orchestration, ShipBob, ShipHero, ERP fulfillment modules, warehouse middleware

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Fulfillment state changes must be durably recorded before downstream shipping notifications fire

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for fulfillment lifecycle events.
* **Details:** Duplicate state transitions must be idempotent on fulfillment identity.

### Worker Scaling
* **Policy:** Fulfillment creation, warehouse assignment, and state transitions must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether fulfillment is single-region or active/passive.
* **Details:** Warehouse assignment must respect regional inventory availability.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If warehouse or shipping capacity is saturated, fulfillment transitions must defer or reject predictably rather than queuing unboundedly.

### Error Taxonomy
### Module-Specific Errors
```
createFulfillment:
    order_already_fulfilled:   Order already has an active fulfillment | return existing
    warehouse_not_available:   Requested warehouse is at capacity | assign alternative

  assignWarehouse:
    warehouse_not_found:       Warehouse ID does not exist | check warehouse_id

  markShipped:
    fulfillment_not_packed:    Fulfillment has not been marked as packed | complete packing first
    fulfillment_cancelled:     Fulfillment was cancelled | cannot ship

  markDelivered:
    fulfillment_not_shipped:   Fulfillment has not been shipped | check tracking status
    fulfillment_cancelled:     Fulfillment was cancelled | cannot deliver

  cancelFulfillment:
    fulfillment_already_shipped: Fulfillment has already shipped | cannot cancel
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createFulfillment  → fulfillment.created      { fulfillment_id, order_id }
assignWarehouse    → fulfillment.warehouse_assigned { fulfillment_id, warehouse_id }
markPacked         → fulfillment.packed        { fulfillment_id }
markShipped        → fulfillment.shipped       { fulfillment_id, tracking_number, carrier }
markDelivered      → fulfillment.delivered     { fulfillment_id, delivered_at }
cancelFulfillment  → fulfillment.cancelled     { fulfillment_id, reason }
```

### Temporal Constraints
```
Fulfillment SLA:
    from_packed_to_shipped:    configurable, default 24 hours
    on_expiry:                 escalate to fulfillment team

  Shipping tracking timeout:
    from_shipped_to_delivered: configurable, default 7 days
    on_expiry:                 flag for carrier investigation

  Fulfillment cancellation window:
    default:                   before shipped state
    on_expiry:                 cancellation not available; return
```

### Storage Model
* **Model:** Durable fulfillment record with milestone history and exception trail.
* **Details:** Fulfillment state transitions are append-only. Each transition is timestamped.

### Database Schema

#### PostgreSQL
```sql
CREATE TYPE fulfillment_status AS ENUM ('pending', 'allocated', 'packed', 'shipped', 'delivered', 'cancelled', 'exception');

CREATE TABLE fulfillments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL UNIQUE,
  warehouse_id      UUID,
  status            fulfillment_status NOT NULL DEFAULT 'pending',
  tracking_number   TEXT,
  carrier           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  packed_at         TIMESTAMPTZ,
  shipped_at        TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ
);

CREATE INDEX idx_fulfillments_status ON fulfillments(status);
CREATE INDEX idx_fulfillments_warehouse ON fulfillments(warehouse_id);

CREATE TABLE fulfillment_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id    UUID NOT NULL REFERENCES fulfillments(id) ON DELETE CASCADE,
  from_status       fulfillment_status,
  to_status         fulfillment_status NOT NULL,
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fulfillment_events_fulfillment ON fulfillment_events(fulfillment_id, created_at);
```

### Failure Modes & Breaking Change Policy

| Failure Mode | Detection | Mitigation |
|---|---|---|
| Warehouse assignment fails | `warehouse_not_available` error | Try alternative warehouse; alert operator |
| Shipping label generation fails | Provider error from carrier | Retry with backoff; escalate after N failures |
| Fulfillment SLA exceeded | Time since last state transition > threshold | Escalate to fulfillment team |
| Duplicate shipping notification | `markShipped` called twice | Idempotent; return existing tracking info |

**Breaking Changes:** Adding a required state to the fulfillment state machine is breaking for existing flows. Removing a state is breaking for in-flight fulfillments. The `FulfillmentStatus` enum changes require migration.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `fulfillment.<function>`.
* **Telemetry Metrics:**
```
blueprint_fulfillment_total                  gauge { status }
blueprint_fulfillment_transitions_total      { from_status, to_status }
blueprint_fulfillment_sla_breach_total       { stage }
blueprint_fulfillment_duration_ms            histogram { stage }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** orders, inventory, shipping
* **Emits To:** events
* **Recommends:** warehousing, notifications, audit_log
