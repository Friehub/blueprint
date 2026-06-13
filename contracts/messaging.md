# Module Contract: `messaging`

**Version:** 1.0.0

---

### `messaging`
Threaded conversation between users or entities.

**Functions**
```
createThread(participants, metadata?) → Thread
getThread(thread_id) → Thread
getThreads(user_id, options?) → PaginatedResult<Thread>
sendMessage(thread_id, sender_id, content, reply_to_id?, attachments?, client_id?) → Message
getMessages(thread_id, options?) → PaginatedResult<Message>
editMessage(message_id, content) → Message
deleteMessage(message_id) → void
markRead(thread_id, user_id) → void
getUnreadCount(user_id) → number
addParticipant(thread_id, user_id) → void
removeParticipant(thread_id, user_id) → void
```

**Types**
```
Thread { id, participants, last_message?, unread_count, created_at }
Message { id, thread_id, sender_id, content, edited, deleted, created_at }
MessageContent { type: text | image | file | system, body, attachments? }
```

**Invariants**
- Deleted messages must show a tombstone, not disappear -- the thread history must remain intact
- A user cannot send a message to a thread they are not a participant of
- Messages within a thread must have monotonically increasing sequence numbers. Sequence numbers are assigned at persist time and are immutable.
- `client_id` prevents duplicate optimistic sends: if a message with the same `(thread_id, client_id)` exists, return the existing message instead of creating a duplicate
- `reply_to_id` must reference an existing message in the same thread; referencing a deleted message is allowed (preserves thread context)

**Providers:** custom database, Stream Chat, Sendbird

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Standard transactional consistency

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for message delivery and read-state propagation.
* **Details:** Duplicate sends must not create duplicate persisted messages.

### Worker Scaling
* **Policy:** Send, read-receipt, and thread-list workloads must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether messaging is single-region or active/passive.
* **Details:** Duplicate cross-region dispatch must be deduplicated by message identity.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If the send pipeline is saturated, the module must defer or reject predictably rather than dropping messages.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
sendMessage          → messaging.message.sent           { message_id, thread_id, sender_id, content_type }
editMessage          → messaging.message.edited          { message_id, thread_id, edit_count }
deleteMessage        → messaging.message.deleted         { message_id, thread_id }
markRead             → messaging.thread.read             { thread_id, user_id, last_read_at }
createThread         → messaging.thread.created          { thread_id, participant_ids }
addParticipant       → messaging.participant.added       { thread_id, user_id }
removeParticipant    → messaging.participant.removed     { thread_id, user_id }
```

### Temporal Constraints
```
Message retention:
    retention:         configurable per workspace or deployment
    on_expiry:         eligible for purge after retention window

  Delivery attempts:
    max_attempts:      configurable per integration, default 3
    backoff:           exponential with jitter
```

### Dead-Letter Handling
* Failed outbound or relay attempts that exhaust retries must remain queryable in a failed store.

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE messaging_threads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT,
  metadata      JSONB DEFAULT '{}',
  last_message_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_threads_updated ON messaging_threads(updated_at DESC);

CREATE TABLE messaging_participants (
  thread_id   UUID NOT NULL REFERENCES messaging_threads(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at     TIMESTAMPTZ,
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX idx_participants_user ON messaging_participants(user_id, joined_at DESC);

CREATE TABLE messaging_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   UUID NOT NULL REFERENCES messaging_threads(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL,
  content     JSONB NOT NULL,
  reply_to_id UUID REFERENCES messaging_messages(id),
  client_id   TEXT,
  edit_count  INT NOT NULL DEFAULT 0,
  deleted     BOOLEAN NOT NULL DEFAULT false,
  sequence    BIGINT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_thread ON messaging_messages(thread_id, sequence);
CREATE UNIQUE INDEX idx_messages_client ON messaging_messages(thread_id, client_id) WHERE client_id IS NOT NULL;

CREATE TABLE messaging_read_receipts (
  thread_id   UUID NOT NULL,
  user_id     UUID NOT NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);
```

### Storage Model
* **Model:** Durable conversation store.
* **Details:** Threads and messages must remain durable and queryable; deleted messages remain as tombstones.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `messaging.<function>`.
* **Telemetry Metrics:**
```
blueprint_messaging_operation_total       counter { function, result: success|failure }
blueprint_messaging_operation_duration_ms histogram { function, p50, p95, p99 }
blueprint_messaging_errors_total          counter { function, error_code }
blueprint_messaging_sent_total            counter { content_type }
blueprint_messaging_threads_active_total  gauge
blueprint_messaging_unread_total          gauge { user_id? }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

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
* **Depends On:** users
* **Emits To:** events
* **Recommends:** notifications (for new message alerts), storage (for attachments)
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `created_at ASC` (oldest first) on `getMessages`.
