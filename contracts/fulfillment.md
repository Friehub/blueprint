# Module Contract: `fulfillment`

**Version:** 0.1.0

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
- A shipped fulfillment cannot be cancelled.
- Fulfillment state must follow the declared progression.
- Tracking details cannot be attached before the shipment state exists.

**Providers:** custom WMS orchestration, ShipBob, ShipHero, ERP fulfillment modules, warehouse middleware

---

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Fulfillment state changes must be durably recorded before downstream shipping notifications fire.
- **Idempotency:** `createFulfillment`, `markShipped`, and `markDelivered` must be idempotent on fulfillment identity.
- **Storage Model:** Durable fulfillment record with milestone history and exception trail.
- **Dependencies:** `orders`, `inventory`, `shipping`, `warehousing`, `notifications`, `audit_log`.
- **Errors:** `FULFILLMENT_NOT_FOUND`, `FULFILLMENT_NOT_SHIPPABLE`, `FULFILLMENT_ALREADY_SHIPPED`, `FULFILLMENT_CANCELLED`, `WAREHOUSE_NOT_AVAILABLE`.
