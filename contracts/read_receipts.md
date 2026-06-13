# Module Contract: `read_receipts`

**Version:** 0.2.0

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
- `markRead` for an already-read message must be a no-op -- it must not update the `read_at` timestamp. The database must enforce idempotent insert via UNIQUE or ON CONFLICT DO NOTHING
- A user must not be able to mark messages as read in a thread they are not a participant of. The module must verify thread membership before inserting any read receipt
- `getUnreadCount` must count messages that were created after the user's last read marker and that the user has access to. Messages the user cannot access must be excluded from the count
- `markBulkRead` must be atomic -- if any message ID in the batch fails validation (not a participant), the entire batch must be rejected
- `subscribeReadReceipts` must deliver receipts in the order they were created per thread; replaying the subscription must not miss receipts
- `getLastReadMessage` must return null when the user has no read receipt in the thread -- it must not return a stale or incorrect value

**Providers:** custom (database-backed), Stream Chat, Sendbird

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Read state must be immediately consistent to prevent incorrect unread counts. The last-read marker per user per thread must be updated atomically with the insertion of each read receipt.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for read receipt events.
* **Details:** Duplicate read receipts must be idempotent (no-op on already-read messages). Real-time broadcast via `subscribeReadReceipts` uses in-order delivery per thread.

### Worker Scaling
* **Policy:** Read receipt writing, unread count aggregation, and real-time broadcast must be independently scalable. Unread count aggregation may be served from a materialised view for high-traffic threads.

### Multi-Region Behavior
* **Mode:** Read state is typically regional with cross-region read state sync for globally distributed threads.
* **Details:** A user's unread count must reflect messages from all regions. Cross-region sync must converge within 5 seconds. Real-time subscriptions are per-region; cross-region delivery is not guaranteed.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If the write path for read receipts is saturated, subscriptions must be prioritised over bulk operations. `markBulkRead` on large batches (1000+ messages) should be queued to avoid blocking the thread.

### Algorithm
* **Recommended:** Materialised last-read cursor per user per thread, updated atomically on each `markRead`. Unread count = count of messages with `created_at > last_read_cursor` that the user has access to.
* **Atomicity:** `markRead` must insert the read receipt and update the last-read cursor in a single transaction. `markBulkRead` must update the cursor to the latest message timestamp in the batch.

### Storage Model
* **Model:** Relational database (PostgreSQL) for read receipts with cursor-based last-read tracking.
* **Details:**
```sql
CREATE TABLE read_receipts (
    message_id      UUID NOT NULL,
    user_id         UUID NOT NULL,
    thread_id       UUID NOT NULL,
    read_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, user_id)
);

CREATE INDEX idx_read_receipts_thread ON read_receipts (thread_id, user_id, read_at DESC);

CREATE TABLE last_read_cursors (
    user_id         UUID NOT NULL,
    thread_id       UUID NOT NULL,
    last_read_at    TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, thread_id)
);
```

### Error Taxonomy
### Module-Specific Errors
```
markRead:
    not_thread_participant:   User is not a participant of the thread | verify thread membership
    message_not_found:        The message ID does not exist in the thread | verify message_id

  markBulkRead:
    batch_validation_failed:  One or more message IDs failed membership check | verify all message_ids

  subscribeReadReceipts:
    not_thread_participant:   User is not a participant of the thread | verify thread membership
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
markRead          → read_receipt.created        { message_id, user_id, thread_id }
markBulkRead      → read_receipt.bulk_created   { user_id, thread_id, count }
markThreadRead    → read_receipt.thread_read    { user_id, thread_id, last_message_id }
```

### Temporal Constraints
```
Read receipt retention:
    duration:       indefinite (serves as audit trail)
    on_expiry:      N/A

  Unread count cache:
    default:        5 seconds
    on_expiry:      recalculate from persisted state

  Last-read cursor:
    duration:       persistent until new markRead in the same thread
    on_expiry:      N/A -- updated on every read operation
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `read_receipts.<function>`.
* **Telemetry Metrics:**
```
blueprint_read_receipts_marked_total            { scope }
blueprint_read_receipts_unread_count            gauge { user_id, thread_id }
blueprint_read_receipts_bulk_batch_size         histogram
blueprint_read_receipts_tracking_duration_ms     histogram { function }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details). `markRead` P99 must be < 50ms. `getUnreadCount` P99 must be < 30ms.

### Module Dependencies
* **Depends On:** messaging
* **Emits To:** events
* **Recommends:** presence, live_updates
