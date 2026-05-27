# Module Contract: `sms`

---

### `sms`
Programmatic SMS delivery.

**Functions**
```
send(to, body, sender_id?, options?) → DeliveryResult
sendBulk(recipients, body) → BulkDeliveryResult
getDeliveryStatus(message_id) → DeliveryStatus
getBalance() → SMSBalance
lookupNumber(phone) → NumberLookup
```

**Types**
```
SMSBalance { amount, currency, units }
NumberLookup { valid, carrier?, country_code, line_type: mobile | landline | voip }
```

**Providers:** Twilio, Termii, Africa's Talking, Vonage

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
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `sms.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none — wraps external provider)
* **Emits To:** events
* **Recommends:** queues, audit_log
