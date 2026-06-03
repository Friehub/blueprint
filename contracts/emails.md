# Module Contract: `emails`

**Version:** 0.1.0

---

### `emails`
Transactional email with template management.

**Functions**
```
sendTransactional(to, template_id, variables, options?) → DeliveryResult
sendBulk(recipients, template_id, variables) → BulkDeliveryResult
createTemplate(name, subject, html, text?) → EmailTemplate
updateTemplate(template_id, data) → EmailTemplate
getTemplate(template_id) → EmailTemplate
listTemplates() → EmailTemplate[]
getDeliveryStatus(message_id) → DeliveryStatus
getDeliveryEvents(message_id) → DeliveryEvent[]
```

**Types**
```
EmailTemplate { id, name, subject, html, text?, variables: string[] }
DeliveryEvent { type: sent|delivered|opened|clicked|bounced|complained, timestamp }
```

**Providers:** Resend, SendGrid, Mailgun, Postmark, AWS SES

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Standard transactional consistency

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once`
* **Details:** Email sends may be retried and must be idempotent at the provider boundary when possible.

### Worker Scaling
* **Policy:** Bulk and transactional send paths must be independently scalable.
* **Details:** A large bulk send must not starve transactional delivery.

### Multi-Region Behavior
* **Mode:** The module must declare whether sending is single-region or active/passive.
* **Details:** Duplicate send attempts across regions must be deduplicated by message identity where supported.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If provider throughput is saturated, the module must defer or reject predictably.
* Bulk sends must not create unbounded provider backlog.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
```
Send attempts:
    max_attempts:      configurable per provider, default 3
    backoff:           exponential with jitter

  Payload size:
    max_size:          configurable per provider, default 256 KiB for rendered payloads
    on_exceed:         reject before send

  Delivery retention:
    max_duration:      configurable, minimum 7 days for failed deliveries and message events
    on_expiry:         eligible for purge after operator review window
```

### Dead-Letter Handling
* Exhausted sends must be retained in a failed or dead-letter view.
* Failed records must retain template_id, recipient, provider reference, failure reason, and attempt count.

### Storage Model
* **Model:** Durable delivery/event log.
* **Details:** Delivery events and send state must remain queryable until retention expiry.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `emails.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none -- wraps external provider)
* **Emits To:** events
* **Recommends:** queues, audit_log
