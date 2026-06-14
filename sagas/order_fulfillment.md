# Saga: `order_fulfillment`

**Version:** 0.1.0

**Modules:** orders → inventory → payments → fulfillment → shipping → notifications → audit_log

---

## Steps

1. **confirm_order(order_id)** → `Order`
   **Compensation:** `orders.cancelOrder(order_id, reason: "fulfillment_failed")`

2. **capture_payment(order_id, payment_id, amount)** → `Payment`
   **Compensation:** `payments.refundPayment(payment_id, reason: "fulfillment_failed")`

3. **deduct_inventory(order_id, items[])**: Reduce stock for each item
   **Compensation:** `inventory.adjustStock(variant_id, +delta, reason: "fulfillment_rollback")` for each item

4. **create_fulfillment(order_id, items[])** → `Fulfillment`
   **Compensation:** `fulfillment.cancelFulfillment(fulfillment_id, reason: "saga_rollback")`

5. **generate_label(fulfillment_id, address, carrier)** → `ShippingLabel`
   **Compensation:** none (label can be voided if not used)

6. **dispatch_shipment(fulfillment_id, label_id)** → `Shipment`
   **Compensation:** `shipping.cancelShipment(shipment_id)` — available during carrier grace period

7. **mark_shipped(order_id, shipment_id)** → `OrderStatus: shipped`
   **Compensation:** `orders.updateOrderStatus(order_id, "confirmed")` — revert status

8. **[async] notify_customer(order_id, tracking_number)** -- Email/SMS tracking info
   **Compensation:** async, non-blocking; retry with notification queue

9. **[async] record_audit(order_id, "order_fulfilled")** -- Compliance trail
   **Compensation:** async, non-blocking

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 2 | Payment capture fails | Cancel order (step 1); return `payment_failed` |
| 3 | Insufficient stock for item | Refund payment (step 2), cancel order (step 1); return `item_unavailable` with item IDs |
| 4 | Fulfillment service unreachable | Retry with exponential backoff (max 3); escalate if persistent |
| 5 | Carrier label generation fails | Retry with alternate carrier; flag for manual intervention |
| 6 | Shipment dispatch fails | Retry with new label; if persistent, flag for manual fulfillment |
