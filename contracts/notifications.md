# Module Contract: `notifications`

**Version:** 0.2.1

---

### `notifications`
Multi-channel message delivery.

**Functions**
```
sendEmail(to, template_id, variables, options?) → DeliveryResult
sendSMS(to, body, options?) → DeliveryResult
sendPush(user_id, title, body, data?) → DeliveryResult
sendBulkPush(user_ids[], notification, options?) → BulkPushResult
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
BulkPushResult { message_id, total_devices, successes, failures: PushError[] }
PushError { device_id, reason: invalid_token|rate_limited|payload_too_large|provider_error }
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
```
sendEmail            → notification.email.sent          { notification_id, recipient, template_id, status }
sendSMS              → notification.sms.sent            { notification_id, recipient, status }
sendPush             → notification.push.sent           { notification_id, user_id, status }
delivery_update      → notification.delivery.updated    { notification_id, channel, from_status, to_status }
delivery_failed      → notification.delivery.failed     { notification_id, channel, attempt, error }
bounced              → notification.bounced             { notification_id, channel, reason }
sendInApp            → notification.in_app.created      { notification_id, user_id, title }
```

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

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE notification_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  channel         TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'in_app')),
  title           TEXT,
  body            TEXT NOT NULL,
  data            JSONB DEFAULT '{}',
  template_id     TEXT,
  template_vars   JSONB,
  status          TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'bounced')),
  provider_reference TEXT,
  provider_response JSONB,
  read            BOOLEAN NOT NULL DEFAULT false,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notification_records(user_id, created_at DESC);
CREATE INDEX idx_notifications_status ON notification_records(status, created_at);
CREATE INDEX idx_notifications_channel ON notification_records(channel, created_at);

CREATE TABLE notification_preferences (
  user_id     UUID PRIMARY KEY,
  channels    JSONB NOT NULL DEFAULT '{"email": true, "sms": true, "push": true, "in_app": true}',
  quiet_hours JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notification_delivery_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id   UUID NOT NULL REFERENCES notification_records(id) ON DELETE CASCADE,
  attempt           INT NOT NULL DEFAULT 1,
  status            TEXT NOT NULL,
  provider_response JSONB,
  error_message     TEXT,
  attempted_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_log_notification ON notification_delivery_log(notification_id, attempt);
```

#### Redis (Push Token Store)
```
Device Token Hash:
  Key:    push_tokens:{user_id}
  Type:   Set
  Members: token strings with metadata (platform, enabled, created_at)
```

### Storage Model
* **Model:** Durable delivery log with a failed-delivery store.
* **Details:** Delivery state and preference snapshots must remain queryable during the retention window.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `notifications.<function>`.
* **Telemetry Metrics:**
```
blueprint_notifications_sent_total           { channel, result }
  blueprint_notifications_bounce_total         { channel }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Sub-Modules

| Sub-Module | Channel | Description |
|---|---|---|
| `push_notifications` | push | Device registration, token management, FCM/APNs/Web Push delivery |
| `emails` (adapter) | email | Transactional email via providers like Resend, SendGrid |
| `sms` (adapter) | sms | SMS/Voice via providers like Twilio, Termii |

`notifications` is the orchestrator. It routes delivery to the appropriate sub-module based on channel preference, quiet hours, and rate limits. Each sub-module owns its provider-specific integration and device state.

### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return provider_error, do not retry indefinitely |
| Provider rate limited | Respect Retry-After header, apply exponential backoff |
| Partial success in batch | Return partial_success with succeeded[] and failed[] |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise

### Module Dependencies
* **Depends On:** users (for preference lookup), push_notifications (for push channel)
* **Emits To:** events
* **Recommends:** queues (for async delivery), audit_log
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `created_at DESC` on `getNotifications`.
