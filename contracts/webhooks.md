# Module Contract: `webhooks`

---

### `webhooks`
Outbound event delivery to external endpoints.

**Functions**
```
registerEndpoint(url, events, secret, metadata?) → WebhookEndpoint
updateEndpoint(endpoint_id, data) → WebhookEndpoint
removeEndpoint(endpoint_id) → void
listEndpoints(owner_id) → WebhookEndpoint[]
dispatchEvent(event_type, payload, owner_id) → void
retryDelivery(delivery_id) → WebhookDelivery
getDeliveries(endpoint_id, options?) → PaginatedResult<WebhookDelivery>
getDelivery(delivery_id) → WebhookDelivery
```

**Types**
```
WebhookEndpoint { id, url, events, status, created_at }
WebhookDelivery { id, endpoint_id, event_type, payload, status, attempts, next_retry_at? }
WebhookStatus = active | disabled | failing
DeliveryStatus = pending | success | failed
```

**Invariants**
- Failed deliveries must be retried with exponential backoff up to a configurable maximum
- Payloads must be signed with the endpoint secret using HMAC-SHA256

**Providers:** custom implementation, Svix, Hookdeck

---

## Part III — Data and State

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
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `webhooks.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none — wraps external provider)
* **Emits To:** events
* **Recommends:** queues, audit_log
