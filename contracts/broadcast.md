# Module Contract: `broadcast`

**Version:** 0.2.1

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
- A broadcast with no matching recipients (after opt-out filtering) must transition directly to `sent` with zero delivered count; it must not remain in `sending`
- `getDeliveryStatus` must reflect the final delivery state for all recipients once the broadcast transitions to `sent`; partial delivery states are only valid while status is `sending` or `partially_delivered`
- Recipient opt-out status must be checked at send time, not at broadcast creation time -- a recipient who opts out between creation and delivery must not receive the broadcast

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
blueprint_broadcast_sent_total                  { channel }
  blueprint_broadcast_delivered_total             { channel, status }
  blueprint_broadcast_recipients_total             { channel }
  blueprint_broadcast_delivery_duration_ms         histogram { channel }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** notifications
* **Emits To:** events
* **Recommends:** analytics, web_analytics, reporting

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE broadcast_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel           TEXT NOT NULL,
  subject           TEXT NOT NULL,
  content           TEXT NOT NULL,
  content_type      TEXT NOT NULL DEFAULT 'text/plain',
  options           JSONB NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'partially_delivered', 'cancelled')),
  total_recipients  INTEGER NOT NULL DEFAULT 0,
  delivered_count   INTEGER NOT NULL DEFAULT 0,
  failed_count      INTEGER NOT NULL DEFAULT 0,
  opened_count      INTEGER NOT NULL DEFAULT 0,
  clicked_count     INTEGER NOT NULL DEFAULT 0,
  bounced_count     INTEGER NOT NULL DEFAULT 0,
  rate_limit        INTEGER,
  tracking_enabled  BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  send_at           TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ
);

CREATE INDEX idx_broadcast_messages_channel ON broadcast_messages(channel, created_at DESC);
CREATE INDEX idx_broadcast_messages_status ON broadcast_messages(status, send_at) WHERE status IN ('scheduled', 'sending');

CREATE TABLE broadcast_recipients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id      UUID NOT NULL REFERENCES broadcast_messages(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL,
  channel           TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),
  delivered_at      TIMESTAMPTZ,
  error_reason      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (broadcast_id, user_id, channel)
);

CREATE INDEX idx_broadcast_recipients_broadcast ON broadcast_recipients(broadcast_id, status);
CREATE INDEX idx_broadcast_recipients_user ON broadcast_recipients(user_id, created_at DESC);

CREATE TABLE broadcast_opt_outs (
  user_id           UUID NOT NULL,
  channel           TEXT NOT NULL,
  opted_out_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel)
);
```

### Storage Model
* **Model:** Durable broadcast message store with per-recipient delivery tracking.
* **Details:** Messages and recipient status use PostgreSQL. Large content bodies may reference object storage for delivery. Opt-out records are checked synchronously at send time.

### Breaking Change Policy
- Adding new recipient status values is additive and backward-compatible.
- Removing or renaming an existing status value requires a MAJOR version bump.
- Changing the default rate limit (1000 recipients/minute) requires a MINOR version bump.
- Adding new required fields to `createBroadcast` input requires a MAJOR version bump.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Recipient receives despite opt-out | Stale opt-out cache | Check opt-out at send time from primary store; cache is write-through |
| Delivery tracking lost | Worker crash mid-batch | Recover unprocessed recipients on restart; idempotent delivery |
| Rate limit exceeded | Burst of scheduled broadcasts | Queue remaining; apply per-channel rate limit; defer to next window |
| Broadcast scheduled in past | Clock skew across services | Send immediately; clamp send_at to max(now(), send_at) |
| Partial delivery timeout | Recipient provider slow | Timeout after 24 hours; mark undelivered as failed; emit broadcast.partially_delivered |
