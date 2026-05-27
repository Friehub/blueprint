# Module Contract: `orders`

---

### `orders`
Order lifecycle management.

**Functions**
```
createOrder(cart_id, user_id, shipping_address, payment_method) → Order
getOrder(order_id) → Order
getOrdersByUser(user_id, options?) → PaginatedResult<Order>
getSellerOrders(seller_id, options?) → PaginatedResult<Order>
getPackagesByOrder(order_id) → OrderPackage[]
getOrderLinesByPackage(package_id) → OrderLine[]
transitionOrderStatus(order_id, status, metadata?) → Order
transitionPackageStatus(package_id, status, metadata?) → OrderPackage
cancelOrder(order_id, reason) → Order
requestReturn(order_id, lines, reason) → ReturnRequest
approveReturn(return_id) → ReturnRequest
```

**Types**
```
Order { id, user_id, lines, packages, status, total, created_at }
OrderPackage { id, order_id, seller_id, lines, status, tracking_number? }
OrderLine { id, variant_id, quantity, unit_price }
OrderStatus = pending | confirmed | processing | shipped | delivered | cancelled | returned
PackageStatus = pending | packed | shipped | delivered | returned
ReturnRequest { id, order_id, lines, reason, status }
```

**Invariants**
- Status transitions must follow the defined state machine — invalid transitions must throw
- A cancelled order must release all stock reservations

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Status transitions must be immediately visible

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for order lifecycle events.
* **Details:** Duplicate order events must not create duplicate state transitions.

### Worker Scaling
* **Policy:** Order transition processing and read queries must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether order processing is single-region or active/passive.
* **Details:** Concurrent cross-region status transitions must be deduplicated.

### Idempotency Requirements
* **Standard:** All state-mutating functions accept an optional `idempotency_key: string` parameter. Keys must be retained for at least 24 hours.
* **Required Functions:**
  - `createOrder(cart_id, user_id, shipping_address, payment_method, idempotency_key?)`
  - `transitionOrderStatus(order_id, status, metadata?, idempotency_key?)`
  - `cancelOrder(order_id, reason, idempotency_key?)`

### Backpressure
* If order processing capacity is saturated, create and transition calls must defer or reject predictably rather than losing state.

### Error Taxonomy
### Module-Specific Errors
```
transitionOrderStatus:
    invalid_transition:        Transition not permitted by state machine | return valid transitions
    order_locked:              Order is being modified by another process | retry after lock_expires_at
    missing_prerequisite:      Required prior action not completed | return prerequisite details

  cancelOrder:
    cancellation_window_expired: Order past cancellation deadline | escalate to return flow
    order_already_shipped:     Cannot cancel after shipment | initiate return instead
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createOrder             → order.created              { order_id, user_id, total, currency, line_count }
  transitionOrderStatus   → order.status.transitioned  { order_id, from_status, to_status, metadata }
  cancelOrder             → order.cancelled            { order_id, reason, cancelled_by }
  requestReturn           → order.return.requested     { order_id, return_id, lines, reason }
  approveReturn           → order.return.approved      { return_id, order_id, refund_amount }
  transitionPackageStatus → order.package.status.transitioned { package_id, order_id, from_status, to_status }
```

### Temporal Constraints
```
Order retention:
    retention:         configurable per deployment
    on_expiry:         archive order history if allowed by policy
```

### Storage Model
* **Model:** Durable transactional order store.
* **Details:** Order state and package state must be strongly consistent; high-volume historical reads may use replicas.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `orders.<function>`.
* **Telemetry Metrics:**
```
gensense_orders_created_total               { currency }
  gensense_orders_by_status                   gauge { status }
  gensense_orders_cancellation_total          { reason }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** cart, inventory, payments, users
* **Emits To:** events
* **Recommends:** notifications, audit_log, shipping
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `created_at DESC` on `getOrdersByUser`.
