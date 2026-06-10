# Module Contract: `webhooks`

**Version:** 0.1.0

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
- Endpoint registration must be rejected if no secret is provided -- a non-empty secret is mandatory
- Every dispatched payload must include a canonical timestamp in the signature input
- The receiver must reject any delivery where the timestamp in the signature is older than 5 minutes -- replay attacks with captured valid signatures are ineffective after this window
- Any URL submitted for endpoint registration must be validated against a configured allowlist of permitted domains before the URL is used
- Any URL that resolves to a private IP address range (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8) or a cloud metadata endpoint (169.254.169.254) must be rejected unconditionally
- Redirect following must be disabled or constrained to the originally allowed domain

**Providers:** custom implementation, Svix, Hookdeck

---

## Part III -- Data and State

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Standard transactional consistency

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once`
* **Details:** Delivery retries may create duplicates; receivers must be idempotent or deduplicate by delivery identity.

### Worker Scaling
* **Policy:** Delivery concurrency must be configurable per endpoint and/or per owner.
* **Details:** High-volume endpoints must support bounded parallelism so one failing target cannot saturate the entire delivery pool.

### Multi-Region Behavior
* **Mode:** The module must declare whether endpoint delivery is active/passive or active/active across regions.
* **Details:** Cross-region retries must preserve the original signature and delivery context.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If an endpoint or owner exceeds delivery capacity, the module must defer, rate-limit, or reject deliveries predictably.
* `dispatchEvent` must never create unbounded in-memory delivery backlog.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
```
Webhook delivery:
    connect_timeout:   2 seconds default
    total_timeout:     30 seconds maximum
    max_attempts:      configurable per endpoint, default 3
    backoff:           exponential with jitter

  Payload size:
    max_size:          configurable per endpoint, default 256 KiB
    on_exceed:         reject before dispatch

  Delivery retention:
    max_duration:      configurable per endpoint, minimum 7 days for failed deliveries
    on_expiry:         eligible for purge after operator review window
```

### Dead-Letter Handling
* Failed deliveries that exhaust retries must move to a dead-letter state or store.
* Dead-letter records must retain endpoint_id, event_type, payload hash, failure reason, and attempt count.
* Poison endpoints must be disabled or quarantined until an operator re-enables them.

### Storage Model
* **Model:** Durable delivery log with a dead-letter store.
* **Details:** Delivery records may be backed by SQL, document storage, or an event log, but retry state and failure history must remain queryable during the retention window.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `webhooks.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none -- wraps external provider)
* **Emits To:** events
* **Recommends:** queues, audit_log
