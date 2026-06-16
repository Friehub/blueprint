# Module Contract: `webhook_delivery`

**Version:** 0.1.0

---

### `webhook_delivery`
Outgoing webhook delivery pipeline — queue, retry, dead-letter, and delivery receipts.

**Functions**
```
registerWebhookEndpoint(url: string, events: any, config?: any) → WebhookEndpoint
sendWebhook(endpoint_id: any, event_type: any, payload: any) → DeliveryAttempt
getDeliveryStatus(delivery_id: any) → DeliveryAttempt
listDeliveries(endpoint_id: any, options?: any) → PaginatedResult<DeliveryAttempt>
retryDelivery(delivery_id: any) → DeliveryAttempt
getDeadLetterQueue(options?: any) → PaginatedResult<DeadLetterEntry>
replayDeadLetter(entry_id: any) → DeliveryAttempt
getDeliveryStats(endpoint_id: any, period: any) → DeliveryStats
```

**Types**
```
WebhookEndpoint { id, url, events, secret, retry_config, dead_letter_config, created_at, updated_at }
DeliveryAttempt { id, endpoint_id, event_type, payload, status, attempt_count, next_retry_at, last_error, created_at }
DeadLetterEntry { id, endpoint_id, event_type, payload, failure_reason, attempt_count, expired_at, created_at }
DeliveryStats { total, succeeded, failed, pending, avg_latency_ms, period_start, period_end }
RetryConfig { max_attempts: 10, base_delay_seconds: 60, deadline_hours: 72, backoff_factor: 5, jitter: bool }
DeadLetterConfig { max_attempts, deadline_hours, notify_on_deadletter: bool }
DeliveryStatus = pending | delivered | failed | retrying | dead_lettered
```

**Invariants**
- Delivery must be at-least-once — a successful HTTP response (2xx) is the only confirmation
- Retry schedule uses exponential backoff with jitter: 1min → 5min → 30min → 2hr → 8hr (repeating until deadline)
- Signature on retry attempts must use the same timestamp as the original attempt to prevent replay attacks
- Dead-letter threshold defaults to 72 hours with 10 max attempts — configurable per endpoint
- Delivery status must always be queryable by the receiving system via a status endpoint
- Failed deliveries must not block new deliveries to the same endpoint

**Providers:** custom queue, Svix, Knock, Webhook Relay

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `at_least_once`
* **Details:** Webhook delivery may be duplicated under network failures; receivers must handle idempotency

### Storage Model
* **Storage:** Outbox table for pending deliveries, dead-letter table for expired attempts
* **Details:** Delivery attempts are append-only; dead-letter entries are retained for 30 days after expiry

### Observability
* **Metrics:** delivery_latency_seconds, delivery_attempts_total, dead_letter_total, queue_depth
* **Alerting:** Alert on dead-letter threshold reached, delivery latency > 5min p99, delivery failure rate > 5%

### Module Dependencies
* **Hard Dependencies:** `webhooks`, `events`
* **Soft Dependencies:** `notifications`, `audit_log`, `outbox_processor`
