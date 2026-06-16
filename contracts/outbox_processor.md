# Module Contract: `outbox_processor`

**Version:** 0.1.0

---

### `outbox_processor`
Transactional outbox pattern — background processor that publishes unpublished events with idempotent handling.

**Functions**
```
publishPending(batch_size?: any) → PublishResult
getOutboxEntry(entry_id: any) → OutboxEntry
listOutboxEntries(status: string, options?: any) → PaginatedResult<OutboxEntry>
markPublished(entry_ids: any) → number
reprocessFailed(entry_ids: any) → ReprocessResult
getPublisherStats(period: any) → PublisherStats
configurePublisher(config: any) → PublisherConfig
```

**Types**
```
OutboxEntry { id, aggregate_type, aggregate_id, event_type, payload, status, attempt_count, last_error, created_at, published_at }
PublishResult { published: number, failed: number, total_processed: number }
ReprocessResult { queued: number, skipped: number }
PublisherStats { entries_pending, entries_published, entries_failed, avg_lag_seconds, period_start, period_end }
PublisherConfig { poll_interval_ms: 1000, batch_size: 100, max_attempts: 5, retry_delay_ms: 5000 }
OutboxStatus = pending | publishing | published | failed
```

**Invariants**
- The processor must be idempotent — running it twice produces the same result
- Optimistic locking must be used when marking entries as published (prevent double-publish)
- Entries must never be deleted, only marked as published (audit trail requirement)
- The processor must not block on a single failed entry — skip and continue the batch
- Publishing order must be preserved per aggregate (FIFO within aggregate_id)
- Poll interval must be configurable per deployment (default 1000ms)

**Providers:** Postgres (SKIP LOCKED), Redis (sorted sets), SQS (visibility timeout)

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `at_least_once`
* **Details:** Outbox entries may be published more than once under network failures; downstream handlers must be idempotent

### Storage Model
* **Storage:** Outbox table with status column and optimistic lock version
* **Details:** Index on (status, created_at) for efficient polling; published entries archived after 7 days

### Observability
* **Metrics:** outbox_lag_seconds, outbox_entries_published_total, outbox_failures_total, outbox_batch_duration_ms
* **Alerting:** Alert on entries pending > 1000 for > 5 minutes, failure rate > 5%

### Module Dependencies
* **Hard Dependencies:** `events`
* **Soft Dependencies:** `webhook_delivery`, `notifications`, `audit_log`
