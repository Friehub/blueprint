# Module Contract: `read_receipts`

**Version:** 0.1.0

---

### `read_receipts`
Message read state tracking with bulk mark, unread counts, and real-time broadcast.

**Functions**
```
markRead(message_id, user_id) → void
markBulkRead(message_ids, user_id) → void
markThreadRead(thread_id, user_id) → void
getUnreadCount(user_id, thread_id?) → number
getReadReceipts(message_id) → ReadReceipt[]
subscribeReadReceipts(thread_id, handler) → ReadReceiptSubscription
getLastReadMessage(thread_id, user_id) → string?
```

**Types**
```
ReadReceipt { message_id, user_id, read_at }
ReadReceiptSubscription { id, thread_id, handler }
UnreadSummary { total, by_thread: Record<string, number>, by_channel: Record<string, number> }
```

**Invariants**
- `markRead` for an already-read message must be a no-op -- it must not update the `read_at` timestamp
- A user must not be able to mark messages as read in a thread they are not a participant of
- `getUnreadCount` must count messages that were created after the user's last read marker and that the user has access to

**Providers:** custom (database-backed), Stream Chat, Sendbird

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Read state must be immediately consistent to prevent incorrect unread counts

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for read receipt events.
* **Details:** Duplicate read receipts must be idempotent (no-op on already-read messages).

### Worker Scaling
* **Policy:** Read receipt writing, unread count aggregation, and real-time broadcast must be independently scalable.

### Multi-Region Behavior
* **Mode:** Read state is typically regional with cross-region read state sync for globally distributed threads.
* **Details:** A user's unread count must reflect messages from all regions.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
markRead          → read_receipt.created        { message_id, user_id, thread_id }
  markBulkRead      → read_receipt.bulk_created   { user_id, thread_id, count }
```

### Temporal Constraints
```
Read receipt retention:
    duration:       indefinite (serves as audit trail)
    on_expiry:      N/A

  Unread count cache:
    default:        5 seconds
    on_expiry:      recalculate from persisted state
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `read_receipts.<function>`.
* **Telemetry Metrics:**
```
gensense_read_receipts_marked_total            { scope }
  gensense_read_receipts_unread_count            gauge { user_id, thread_id }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** messaging
* **Emits To:** events
* **Recommends:** presence, live_updates
