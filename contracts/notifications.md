# Module Contract: `notifications`

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
- `sendEmail` must respect `NotificationPreferences` — if email is disabled, it must not deliver
- `sendPush` must not throw if the user has no registered push tokens — it must return a no-op result

**Providers:** Resend/SendGrid (email), Twilio/Termii (SMS), FCM/APNs (push)

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** Delivery status updates are eventually consistent

### Idempotency Requirements
* **Standard:** All state-mutating functions accept an optional `idempotency_key: string` parameter. Keys must be retained for at least 24 hours.
* **Required Functions:**
  - `sendEmail(to, template_id, variables, options?, idempotency_key?)`
  - `sendSMS(to, body, options?, idempotency_key?)`

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
* None explicitly defined.

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
