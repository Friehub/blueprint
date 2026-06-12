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

### Invariants
- `createShipment` with the same `order_id` must be idempotent — duplicate calls must return the existing shipment and not create duplicates
- `cancelShipment` on an already-cancelled shipment must be a no-op
- `trackShipment` must return the most recent tracking event from the carrier; stale events older than `max_lag` must be surfaced as stale tracking status
- A label URL returned by `createLabel` must be a signed, time-limited URL — the URL must expire after the configured label expiry duration
- `validateAddress` must never surface full address data in logs or span attributes — only the validation result (valid, normalized address without unit numbers, suggestions) may be emitted

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Shipment state and tracking history must be immediately consistent within the data store; carrier-side state is eventually consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for shipment state updates and tracking events.
* **Details:** Duplicate tracking callbacks must not duplicate shipments — upsert on tracking_number.

### Worker Scaling
* **Policy:** Rate lookup, label creation, and tracking ingestion must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether shipping is single-region or active/passive.
* **Details:** Duplicate cross-region shipment creation must be deduplicated by idempotency_key.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Required Functions:** `createShipment`, `cancelShipment`, `createLabel`

### Backpressure
* If carrier adapters are saturated or rate-limited, the module must defer or reject predictably rather than silently dropping shipment operations. `getRates` must return a `RateLimited` error when carrier rate-limit is exceeded.

### Error Taxonomy
### Module-Specific Errors
```
createShipment:
    carrier_unavailable:     The selected carrier is not available | choose a different carrier
    invalid_rate:            The selected rate has expired or is invalid | request new rates

  trackShipment:
    tracking_unavailable:    Tracking data is not yet available from the carrier | retry later

  validateAddress:
    address_not_found:       The address could not be validated | request manual entry
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createShipment   → shipping.shipment.created    { shipment_id, order_id, carrier }
cancelShipment   → shipping.shipment.cancelled   { shipment_id }
trackShipment    → shipping.tracking.updated     { shipment_id, tracking_number, status }
createLabel      → shipping.label.created        { shipment_id, format }
```

### Temporal Constraints
```
Tracking freshness:
    max_lag:           configurable per carrier integration, default 15 minutes
    on_exceed:         surface stale tracking status; flag shipment for manual review

  Label expiry:
    duration:          configurable, default 7 days
    on_expiry:         label URL becomes invalid; new label must be created

  Shipment retention:
    duration:          configurable, minimum 90 days
    on_expiry:         shipment record eligible for archival or purge
```

### Storage Model
* **Model:** Durable shipment record store with tracking history.
* **Details:** Labels may be object-storage backed; shipment state must remain queryable until retention expiry.

```sql
CREATE TABLE shipments (
    id              UUID PRIMARY KEY,
    order_id        UUID NOT NULL REFERENCES orders(id),
    carrier         VARCHAR(100) NOT NULL,
    tracking_number VARCHAR(255),
    status          VARCHAR(50) NOT NULL DEFAULT 'pending',
    label_url       TEXT,
    label_expires_at TIMESTAMPTZ,
    idempotency_key VARCHAR(255) UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tracking_events (
    id              UUID PRIMARY KEY,
    shipment_id     UUID NOT NULL REFERENCES shipments(id),
    status          VARCHAR(100) NOT NULL,
    location        VARCHAR(255),
    description     TEXT,
    occurred_at     TIMESTAMPTZ NOT NULL,
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shipments_order_id ON shipments(order_id);
CREATE INDEX idx_tracking_events_shipment ON tracking_events(shipment_id, occurred_at DESC);
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `shipping.<function>`.
* **Telemetry Metrics:**
```
gensense_shipping_operation_total           counter { function, result: success|failure }
gensense_shipping_operation_duration_ms     histogram { function, p50, p95, p99 }
gensense_shipping_errors_total              counter { function, error_code }
gensense_shipping_shipments_created_total   counter { carrier }
gensense_shipping_tracking_events_ingested  counter { carrier }
gensense_shipping_labels_created_total      counter { format }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Carrier API unavailable | Return ProviderError, do not retry indefinitely; queue for retry if possible |
| Carrier rate limited | Respect Retry-After header, apply exponential backoff; surface stale tracking status |
| Label generation fails | Return error; shipment is not blocked but no label is produced |
| Address validation service down | Return address_not_found; allow fallback to manual address entry |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise

### Module Dependencies
* **Depends On:** orders
* **Emits To:** events
* **Recommends:** notifications (for tracking updates)
