# Module Contract: `emails`

**Version:** 0.1.0

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

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once`
* **Details:** Email sends may be retried and must be idempotent at the provider boundary when possible.

### Worker Scaling
* **Policy:** Bulk and transactional send paths must be independently scalable.
* **Details:** A large bulk send must not starve transactional delivery.

### Multi-Region Behavior
* **Mode:** The module must declare whether sending is single-region or active/passive.
* **Details:** Duplicate send attempts across regions must be deduplicated by message identity where supported.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If provider throughput is saturated, the module must defer or reject predictably.
* Bulk sends must not create unbounded provider backlog.

### Error Taxonomy
### Module-Specific Errors
```
sendTransactional:
    invalid_template:          Template not found or is in draft | use existing published template
    missing_variable:          Required template variable not provided | supply all declared variables
    provider_rejected:         Provider rejected the send (bounce, spam, invalid recipient) | check recipient
    rate_limited_provider:     Provider rate limit reached | retry with backoff

  sendBulk:
    too_many_recipients:       Recipient list exceeds bulk limit | split into batches
    partial_failure:           Some recipients failed; partial delivery | check failed list in result

  createTemplate:
    template_name_taken:       Template name already exists | use unique name

  getDeliveryStatus:
    message_not_found:         Message ID not found | verify message_id
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
sendTransactional → email.sent                     { message_id, template_id, recipient, provider }
                   OR email.send.failed            { message_id, template_id, recipient, reason }
sendBulk         → email.bulk.sent                 { batch_id, template_id, recipient_count, success_count }
createTemplate   → email.template.created          { template_id, name }
updateTemplate   → email.template.updated          { template_id, name }
getDeliveryEvent → email.delivery.event            { message_id, event_type, timestamp }
                 → email.bounced                   { message_id, recipient, reason }
                 → email.complained                { message_id, recipient }
```

### Temporal Constraints
```
Send attempts:
    max_attempts:      configurable per provider, default 3
    backoff:           exponential with jitter

  Payload size:
    max_size:          configurable per provider, default 256 KiB for rendered payloads
    on_exceed:         reject before send

  Delivery retention:
    max_duration:      configurable, minimum 7 days for failed deliveries and message events
    on_expiry:         eligible for purge after operator review window
```

### Dead-Letter Handling
* Exhausted sends must be retained in a failed or dead-letter view.
* Failed records must retain template_id, recipient, provider reference, failure reason, and attempt count.

### Storage Model
* **Model:** Durable delivery/event log.
* **Details:** Delivery events and send state must remain queryable until retention expiry.

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE email_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL UNIQUE,
  subject           TEXT NOT NULL,
  html              TEXT NOT NULL,
  text              TEXT,
  variables         JSONB NOT NULL DEFAULT '[]',
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE email_deliveries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id        TEXT NOT NULL,
  template_id       UUID REFERENCES email_templates(id),
  recipient         TEXT NOT NULL,
  provider          TEXT NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed')),
  failure_reason    TEXT,
  attempt_count     INT NOT NULL DEFAULT 0,
  provider_ref      TEXT,
  idempotency_key   TEXT UNIQUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_deliveries_message ON email_deliveries(message_id);
CREATE INDEX idx_email_deliveries_recipient ON email_deliveries(recipient);
CREATE INDEX idx_email_deliveries_status ON email_deliveries(status) WHERE status IN ('failed', 'bounced');

CREATE TABLE email_delivery_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id       UUID NOT NULL REFERENCES email_deliveries(id) ON DELETE CASCADE,
  event_type        TEXT NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained')),
  timestamp         TIMESTAMPTZ NOT NULL,
  metadata          JSONB
);

CREATE INDEX idx_email_events_delivery ON email_delivery_events(delivery_id);
```

### Failure Modes & Breaking Change Policy

| Failure Mode | Detection | Mitigation |
|---|---|---|
| Provider rate limit | `rate_limited_provider` error | Queue and retry with exponential backoff; alert if sustained |
| Template variable mismatch | Provider returns rendering error | Validate all variables at send time; reject with `missing_variable` |
| Bulk send partial failure | `partial_failure` in result | Report per-recipient status; retry failed subset |
| Bounce rate exceeds threshold | High bounce count in delivery events | Pause sends to domain; review list hygiene |
| Provider outage | All sends fail with provider error | Failover to secondary provider if configured |

**Breaking Changes:** Template variable removal is breaking for active sends. Removing a template variable that is in use will cause rendering failures. Variable additions are non-breaking. Provider configuration changes must support gradual rollout.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `emails.<function>`.
* **Telemetry Metrics:**
```
blueprint_emails_sent_total                 { provider, status }
blueprint_emails_delivery_duration_ms        histogram { provider }
blueprint_emails_bounce_total                { provider, reason }
blueprint_emails_complaint_total             { provider }
blueprint_emails_template_count              gauge { status }
blueprint_emails_provider_latency_ms         gauge { provider }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none -- wraps external provider)
* **Emits To:** events
* **Recommends:** queues, audit_log
