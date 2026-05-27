# Module Contract: `messaging`

---

### `messaging`
Threaded conversation between users or entities.

**Functions**
```
createThread(participants, metadata?) → Thread
getThread(thread_id) → Thread
getThreads(user_id, options?) → PaginatedResult<Thread>
sendMessage(thread_id, sender_id, content) → Message
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
- Deleted messages must show a tombstone, not disappear — the thread history must remain intact
- A user cannot send a message to a thread they are not a participant of

**Providers:** custom database, Stream Chat, Sendbird

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Standard transactional consistency

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
* None explicitly defined.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `messaging.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** users
* **Emits To:** events
* **Recommends:** notifications (for new message alerts), storage (for attachments)
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `created_at ASC` (oldest first) on `getMessages`.
