# Module Contract: `warehousing`

**Version:** 0.1.0

---

### `warehousing`
Warehouse shelf bin locations, internal inventory movements, and picking/packing fulfillment workflows.

**Functions**
```
registerBin(warehouse_id, zone, shelf, position) → WarehouseBin
assignStockToBin(variant_id, bin_id, quantity) → void
createPickList(order_id) → PickList
confirmPick(pick_list_id, picker_id) → void
moveStock(source_bin_id, dest_bin_id, quantity) → void
```

**Types**
```
WarehouseBin { id, warehouse_id, zone, shelf, position, status }
BinStock { bin_id, variant_id, quantity }
PickList { id, order_id, status, items, created_at }
PickListItem { variant_id, quantity, bin_id, status }

BinStatus = active | suspended
PickListStatus = pending | picking | packed | cancelled
PickItemStatus = pending | picked | omitted
```

**Invariants**
- **Non-Negative Stocks**: Stock quantities within a shelf bin location (`BinStock.quantity`) must never drop below zero.
- **Atomic Stock Transfers**: Moving stock (`moveStock`) from a source bin to a destination bin must subtract from the source and add to the destination atomically within a single transaction.
- **Isolation of Suspended Bins**: Items allocated inside a `suspended` bin location cannot be targeted by `createPickList` for orders.

**Providers:** custom database WMS, NetSuite WMS API, ShipHero API, Körber WMS

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Bin inventory stock adjustments and pick list locking must be immediately consistent to avoid dual picking conflicts.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Required Functions:**
  - `confirmPick(pick_list_id, picker_id, idempotency_key?)`

### Error Taxonomy
### Module-Specific Errors
```
moveStock:
    insufficient_bin_stock:    The source bin contains less inventory than the transfer amount | reject
    bin_not_found:             The target or source bin ID does not exist | return 404

confirmPick:
    already_confirmed:         The pick list has already been picked | return existing confirmation
    pick_cancelled:            The pick list has been cancelled by another process | reject
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
assignStockToBin    → warehousing.stock.assigned    { variant_id, bin_id, quantity }
confirmPick         → warehousing.pick.confirmed    { pick_list_id, picker_id }
moveStock           → warehousing.stock.moved       { source_bin_id, dest_bin_id, quantity }
```

### Temporal Constraints
* None explicitly defined.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `warehousing.<function>`.
* **Telemetry Metrics:**
```
gensense_warehousing_active_picking_lists   gauge
gensense_warehousing_bin_levels_snapshot    gauge { bin_id, variant_id }
gensense_warehousing_stock_movements_total  counter { warehouse_id }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** catalog, inventory
* **Emits To:** events
* **Recommends:** audit_log, queues (to process pick lists asynchronously)
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `created_at DESC` on pick lists.
