# Module Contract: `shipping`

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
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `shipping.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** orders
* **Emits To:** events
* **Recommends:** notifications (for tracking updates)
