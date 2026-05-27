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

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once`
* **Details:** SMS delivery attempts may repeat; provider and caller deduplication should be supported where possible.

### Worker Scaling
* **Policy:** Bulk sends and number lookup traffic must be independently scalable.
* **Details:** Lookup traffic must not be blocked by send throughput.

### Multi-Region Behavior
* **Mode:** The module must declare whether delivery is single-region or active/passive.
* **Details:** Duplicate sends caused by regional failover must be deduplicated by message identity when supported.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If provider capacity is saturated, the module must return a predictable retry signal or defer sending.
* `sendBulk` must not allow unbounded backlog growth.

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
    max_size:          configurable per provider, default 140 bytes for user-visible text payloads when applicable
    on_exceed:         reject or split depending on provider capability

  Delivery retention:
    max_duration:      configurable, minimum 7 days for failed sends
    on_expiry:         eligible for purge after operator review window
```

### Dead-Letter Handling
* Exhausted sends must move to a failed store or dead-letter view.
* Failed records must retain recipient, sender_id, provider reference, failure reason, and attempt count.

### Storage Model
* **Model:** Durable delivery log.
* **Details:** Send state and failure history must remain queryable during the retention window.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `sms.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none -- wraps external provider)
* **Emits To:** events
* **Recommends:** queues, audit_log
