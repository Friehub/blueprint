# Module Contract: `emails`

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
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `emails.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none — wraps external provider)
* **Emits To:** events
* **Recommends:** queues, audit_log
