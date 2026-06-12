# Module Contract: `sms`

**Version:** 0.1.0

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

### Invariants
- `send` must reject payloads exceeding `max_size` with a `ValidationError` — truncation without caller consent is not permitted
- `sendBulk` must process recipients independently — failure for one recipient must not block delivery to others
- `getDeliveryStatus` for a message that has exhausted all retry attempts must return a terminal failure status
- A message sent with an `idempotency_key` must not be dispatched more than once — duplicate calls must return the existing DeliveryResult

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Delivery log state must be immediately consistent; provider-side delivery status is eventually consistent

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
* **Required Functions:** `send`, `sendBulk`

### Backpressure
* If provider capacity is saturated, the module must return a predictable retry signal or defer sending.
* `sendBulk` must not allow unbounded backlog growth — implement a configurable max queue depth per provider.

### Error Taxonomy
### Module-Specific Errors
```
send:
    provider_unreachable:     Provider is not reachable | queue for retry
    invalid_recipient:        Phone number is invalid or blocked | do not retry
    content_blocked:          Message content rejected by provider or carrier | do not retry

  sendBulk:
    partial_failure:          Some recipients failed | inspect failed[] for details
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
send         → sms.sent               { message_id, recipient, status }
sendBulk     → sms.bulk.completed     { batch_id, succeeded_count, failed_count }
getDeliveryStatus → sms.delivery.updated  { message_id, status }
```

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

```sql
CREATE TABLE sms_messages (
    id              UUID PRIMARY KEY,
    recipient       VARCHAR(20) NOT NULL,
    body            TEXT NOT NULL,
    sender_id       VARCHAR(100),
    status          VARCHAR(50) NOT NULL DEFAULT 'pending',
    provider        VARCHAR(100),
    provider_ref    VARCHAR(255),
    attempt_count   INTEGER NOT NULL DEFAULT 0,
    max_attempts    INTEGER NOT NULL DEFAULT 3,
    last_error      TEXT,
    idempotency_key VARCHAR(255) UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sms_delivery_events (
    id              UUID PRIMARY KEY,
    message_id      UUID NOT NULL REFERENCES sms_messages(id),
    status          VARCHAR(50) NOT NULL,
    provider_status VARCHAR(255),
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sms_messages_status ON sms_messages(status);
CREATE INDEX idx_sms_delivery_events_message ON sms_delivery_events(message_id);
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `sms.<function>`.
* **Telemetry Metrics:**
```
blueprint_sms_operation_total               counter { function, result: success|failure }
blueprint_sms_operation_duration_ms         histogram { function, p50, p95, p99 }
blueprint_sms_errors_total                  counter { function, error_code }
blueprint_sms_messages_sent_total           counter { provider, status }
blueprint_sms_bulk_recipients_total         counter { provider }
blueprint_sms_balance_gauge                 gauge { currency }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Provider unavailable for send | Return provider_unreachable, queue for retry with backoff |
| Provider rate limited | Respect Retry-After header, apply exponential backoff |
| Invalid recipient number | Return invalid_recipient, do not retry |
| Partial failure in sendBulk | Return partial_failure with succeeded[] and failed[] arrays |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise

### Module Dependencies
* **Depends On:** (none -- wraps external provider)
* **Emits To:** events
* **Recommends:** queues, audit_log
