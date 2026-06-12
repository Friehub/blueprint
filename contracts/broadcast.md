# Module Contract: `broadcast`

**Version:** 0.1.0

---

### `broadcast`
One-to-many message broadcast with channel filtering, delivery confirmation, and rate control.

**Functions**
```
createBroadcast(channel, content, options?) → BroadcastMessage
sendBroadcast(broadcast_id) → SendResult
scheduleBroadcast(broadcast_id, send_at) → void
getBroadcast(broadcast_id) → BroadcastMessage
listBroadcasts(channel?, status?) → BroadcastMessage[]
getDeliveryStatus(broadcast_id) → DeliveryReport
cancelBroadcast(broadcast_id) → void
```

**Types**
```
BroadcastMessage { id, channel, subject, content, content_type, options: BroadcastOptions, status: draft|scheduled|sending|sent|partially_delivered|cancelled, created_at }
SendResult { broadcast_id, total_recipients, delivered, failed, in_progress, duration_ms }
DeliveryReport { broadcast_id, total, delivered, opened, clicked?, bounced, failed, by_segment }
DeliveryRecipient { user_id, channel, status: pending|delivered|opened|clicked|bounced|failed, delivered_at? }
BroadcastOptions { channels: string[], segments?: Segment[], rate_limit?, priority?, tracking: bool }
Segment { field, operator, value }
```

**Invariants**
- A broadcast must not send to recipients who have opted out of the broadcast channel
- `cancelBroadcast` must stop delivery to recipients who have not yet received the message -- it must not recall delivered messages
- `scheduleBroadcast` with a send_at in the past must send immediately

**Providers:** OneSignal, Firebase, SendGrid (broadcast), Mailgun, custom

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** Broadcast delivery is asynchronous; delivery reports converge as recipients are processed

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` per recipient.
* **Details:** A recipient may receive the broadcast multiple times if delivery confirmation is delayed; idempotent handling is recommended.

### Worker Scaling
* **Policy:** Broadcast sending, delivery tracking, and rate limiting must be independently scalable.

### Multi-Region Behavior
* **Mode:** Broadcasts are sent from the region closest to the recipient or from a central sending region.
* **Details:** Delivery tracking must be aggregated globally regardless of sending region.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
sendBroadcast     → broadcast.sent               { broadcast_id, channel, total_recipients }
  scheduleBroadcast → broadcast.scheduled           { broadcast_id, send_at, total_recipients }
  Delivery event    → broadcast.delivered            { broadcast_id, recipient_id }
                   OR broadcast.bounced              { broadcast_id, recipient_id, reason }
```

### Temporal Constraints
```
Broadcast rate limit:
    default:        1000 recipients per minute
    on_exceed:      queue remaining recipients for next window

  Delivery tracking timeout:
    default:        24 hours
    on_expiry:      undelivered marked as failed in DeliveryReport
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `broadcast.<function>`.
* **Telemetry Metrics:**
```
gensense_broadcast_sent_total                  { channel }
  gensense_broadcast_delivered_total             { channel, status }
  gensense_broadcast_recipients_total             { channel }
  gensense_broadcast_delivery_duration_ms         histogram { channel }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** notifications
* **Emits To:** events
* **Recommends:** analytics, web_analytics, reporting
