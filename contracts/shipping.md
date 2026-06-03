# Module Contract: `shipping`

**Version:** 0.1.0

---

### `shipping`
Shipment creation and tracking.

**Functions**
```
getRates(origin, destination, parcels) → ShippingRate[]
createShipment(order_id, rate_id, parcels) → Shipment
getShipment(shipment_id) → Shipment
trackShipment(tracking_number, carrier?) → TrackingResult
cancelShipment(shipment_id) → void
createLabel(shipment_id) → ShippingLabel
getLabel(shipment_id) → ShippingLabel
validateAddress(address) → AddressValidation
```

**Types**
```
ShippingRate { carrier, service, price, currency, estimated_days }
Shipment { id, order_id, carrier, tracking_number, status, label_url? }
TrackingResult { status, events: TrackingEvent[], estimated_delivery? }
TrackingEvent { status, location, timestamp, description }
ShippingLabel { url, format: pdf|png, expires_at }
AddressValidation { valid, normalized_address?, suggestions? }
```

**Providers:** EasyPost, Shippo, DHL API, custom last-mile carriers

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Standard transactional consistency

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for shipment state updates and tracking events.
* **Details:** Duplicate tracking callbacks must not duplicate shipments.

### Worker Scaling
* **Policy:** Rate lookup, label creation, and tracking ingestion must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether shipping is single-region or active/passive.
* **Details:** Duplicate cross-region shipment creation must be deduplicated.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If carrier adapters are saturated or rate-limited, the module must defer or reject predictably rather than silently dropping shipment operations.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
```
Tracking freshness:
    max_lag:           configurable per carrier integration
    on_exceed:         surface stale tracking status
```

### Storage Model
* **Model:** Durable shipment record store with tracking history.
* **Details:** Labels may be object-storage backed; shipment state must remain queryable until retention expiry.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `shipping.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** orders
* **Emits To:** events
* **Recommends:** notifications (for tracking updates)
