# Saga: `marketplace_order`

**Version:** 0.1.0

**Modules:** catalog → cart → inventory → payments → fulfillment → shipping

---

## Steps

1. **validate_cart_items(cart_id, user_id)** -- Verify all items are in stock, prices are current, and seller is active.
   **Compensation:** none (read-only; cart snapshot retained)

2. **reserve_inventory(cart_items)** → `InventoryReservation[]`
   **Compensation:** `inventory.releaseReservation(reservation_ids)` -- releases held stock

3. **process_payment(user_id, amount, payment_method)** → `PaymentIntent`
   **Compensation:** `payments.refund(payment_intent_id)` -- issues full refund

4. **create_fulfillment_order(order_id, seller_id, items)** → `FulfillmentOrder`
   **Compensation:** `fulfillment.cancelFulfillment(fulfillment_order_id)` -- cancels pending fulfillment

5. **create_shipping_label(fulfillment_order_id, address)** → `ShippingLabel`
   **Compensation:** `shipping.voidLabel(shipping_label_id)` -- voids the label

6. **[async] notify_seller(seller_id, order_id)** -- Alert seller of new order
   **Compensation:** none (informational; queued for retry)

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 1 | Item price changed or out of stock | Return `cart_stale` error; prompt user to refresh |
| 3 | Payment declined | Release inventory reservations; inform user |
| 4 | Fulfillment creation fails | Refund payment; release inventory; alert operator |
| 5 | Shipping label generation fails | Fulfillment still created; notify seller to label manually |

---

## Invariants

- Inventory must be reserved before payment is captured
- A successful payment must always have a corresponding fulfillment order
- Order total must equal sum of line-item prices plus taxes and shipping
