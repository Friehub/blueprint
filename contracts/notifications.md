# Module Contract: `notifications`

**Version:** 0.1.0

---

### `notifications`
Multi-channel message delivery.

**Functions**
```
sendEmail(to, template_id, variables, options?) → DeliveryResult
sendSMS(to, body, options?) → DeliveryResult
sendPush(user_id, title, body, data?) → DeliveryResult
sendInApp(user_id, notification) → Notification
getNotifications(user_id, options?) → PaginatedResult<Notification>
markRead(notification_id) → void
markAllRead(user_id) → void
getUnreadCount(user_id) → number
updatePreferences(user_id, preferences) → NotificationPreferences
getPreferences(user_id) → NotificationPreferences
```

**Types**
```
Notification { id, user_id, title, body, data?, read, created_at }
DeliveryResult { message_id, status, provider_reference }
NotificationChannel = email | sms | push | in_app
NotificationPreferences { channels: Record<NotificationChannel, boolean>, quiet_hours? }
DeliveryStatus = queued | sent | delivered | failed | bounced
```

**Invariants**
- `sendEmail` must respect `NotificationPreferences` -- if email is disabled, it must not deliver
- `sendPush` must not throw if the user has no registered push tokens -- it must return a no-op result

**Providers:** Resend/SendGrid (email), Twilio/Termii (SMS), FCM/APNs (push)

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** Delivery status updates are eventually consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once`
* **Details:** Duplicate delivery attempts are expected; recipients and adapters must tolerate redelivery.

### Worker Scaling
* **Policy:** Delivery concurrency must be configurable per channel and per recipient scope.
* **Details:** Email, SMS, push, and in-app delivery should be independently throttleable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether notification delivery is single-region or active/passive.
* **Details:** If delivery spans regions, duplicate sends must be deduplicated by delivery identity.

### Idempotency Requirements
* **Standard:** All state-mutating functions accept an optional `idempotency_key: string` parameter. Keys must be retained for at least 24 hours.
* **Required Functions:**
  - `sendEmail(to, template_id, variables, options?, idempotency_key?)`
  - `sendSMS(to, body, options?, idempotency_key?)`

### Backpressure
* If a channel or recipient exceeds delivery capacity, the module must defer, rate-limit, or reject predictably.
* `sendEmail` and `sendSMS` must not create unbounded delivery backlog.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
```
Delivery attempts:
    max_attempts:      configurable per channel, default 3
    backoff:           exponential with jitter

  Payload size:
    max_size:          configurable per channel, default 256 KiB for message payloads
    on_exceed:         reject before dispatch

  Delivery retention:
    max_duration:      configurable per channel, minimum 7 days for failed deliveries
    on_expiry:         eligible for purge after operator review window
```

### Dead-Letter Handling
* Failed deliveries that exhaust retries must move to a dead-letter state or store.
* Dead-letter records must retain channel, recipient, provider reference, failure reason, and attempt count.
* Poison recipients or templates may be quarantined until an operator clears them.

### Storage Model
* **Model:** Durable delivery log with a failed-delivery store.
* **Details:** Delivery state and preference snapshots must remain queryable during the retention window.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `notifications.<function>`.
* **Telemetry Metrics:**
```
gensense_notifications_sent_total           { channel, result }
  gensense_notifications_bounce_total         { channel }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** users (for preference lookup)
* **Emits To:** events
* **Recommends:** queues (for async delivery), audit_log
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `created_at DESC` on `getNotifications`.
