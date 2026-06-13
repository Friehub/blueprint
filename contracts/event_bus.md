# Module Contract: `event_bus`

**Version:** 0.2.1

---

### `event_bus`
Typed event publish-subscribe with filtering, replay, and dead-letter management.

**Functions**
```
publish(topic, event) → EventId
publishBulk(topic, events) → EventId[]
subscribe(topic, handler, filter?) → Subscription
unsubscribe(subscription_id) → void
getSubscriptions(topic?) → Subscription[]
replay(topic, from, to, target_subscription?) → ReplayResult
getDeadLetters(topic, options?) → PaginatedResult<DeadLetter>
retryDeadLetter(dead_letter_id) → void
```

**Types**
```
Event<T> { id, topic, payload: T, metadata: EventMetadata, timestamp, version }
Subscription { id, topic, handler, filter?, status: active|paused, created_at }
EventMetadata { producer, correlation_id?, causation_id?, idempotency_key? }
ReplayResult { topic, events_replayed, subscriptions_delivered, from, to }
DeadLetter { id, original_event, subscription_id, failure_reason, failed_at, retry_count }
```

**Invariants**
- `subscribe` must only receive events published after subscription, not before (unless `replay` is used)
- A message that exhausts its delivery retries must transition to the dead-letter queue, not be silently dropped
- `publish` must persist the event before delivering to any subscriber

**Providers:** Kafka, NATS, RabbitMQ, AWS EventBridge, Redis Streams

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Event persistence before delivery ensures at-least-once semantics

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` by default; subscribers must be idempotent.
* **Details:** Topic replay must preserve ordering within a partition when the underlying transport supports it.

### Worker Scaling
* **Policy:** Publish, subscription delivery, and dead-letter processing must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether the bus is single-region or multi-region mirrored.
* **Details:** Cross-region duplicates must be deduplicated by event identity.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If subscriber lag or publish throughput is saturated, the bus must apply backpressure or bounded buffering rather than unbounded growth.

### Algorithm
* **Recommended:** Partitioned log for ordered event streaming. Topic-based pub-sub for fan-out delivery. Consumer groups for load balancing across subscribers.
* **Details:** Partitioned log (e.g., Kafka) provides ordering within a partition and replay capability. Topic-based pub-sub (e.g., NATS) provides low-latency fan-out. Consumer groups enable parallel processing with partition assignment. Tradeoff: partitioned log offers durability and replay but higher latency; pub-sub offers lower latency but less durability.
* **Atomicity:** Event publish must be atomic with persistence. Events must not be delivered to subscribers before persistence confirmation. At-least-once delivery requires idempotent subscribers.

### Error Taxonomy
### Module-Specific Errors
```
publish:
    topic_not_found:        Topic does not exist | create topic before publishing
    payload_too_large:      Event payload exceeds maximum size | split or compress

  subscribe:
    handler_already_exists: Handler is already registered for this topic and filter | update existing subscription

  replay:
    window_too_large:       Replay window exceeds maximum range | narrow from/to bounds
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope. The bus itself emits lifecycle events for subscriptions and dead-letter state.

### Temporal Constraints
```
Topic retention:
    retention:         configurable per topic, default 7 days
    on_expiry:         events eligible for compaction or purge

  Delivery retry:
    max_attempts:      configurable per subscription, default 3
    backoff:           exponential with jitter, 1s initial, 60s max

  Dead-letter retention:
    max_duration:      configurable, minimum 7 days
    on_expiry:         eligible for purge after operator review
```

### Dead-Letter Handling
* Events that exhaust delivery retries must transition to the dead-letter queue with the original payload, failure reason, attempt count, and timestamps.
* `retryDeadLetter` must re-enqueue the event for delivery with a fresh retry budget.

### Storage Model
* **Model:** Durable event store with topic retention, subscription state, and dead-letter queue.
* **Details:** Events must be persisted before delivery. Topic retention is configurable per topic.

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE event_bus_topics (
  name              TEXT PRIMARY KEY,
  retention_days    INT NOT NULL DEFAULT 7,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE event_bus_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic             TEXT NOT NULL REFERENCES event_bus_topics(name),
  payload           JSONB NOT NULL,
  metadata          JSONB NOT NULL,
  event_version     INT NOT NULL DEFAULT 1,
  partition_key     TEXT,
  offset_id         BIGSERIAL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_topic_created ON event_bus_events(topic, created_at DESC);

CREATE TABLE event_bus_subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic             TEXT NOT NULL REFERENCES event_bus_topics(name),
  handler           TEXT NOT NULL,
  filter            JSONB,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_topic ON event_bus_subscriptions(topic);

CREATE TABLE event_bus_dead_letters (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic             TEXT NOT NULL,
  original_event    JSONB NOT NULL,
  subscription_id   UUID REFERENCES event_bus_subscriptions(id),
  failure_reason    TEXT NOT NULL,
  retry_count       INT NOT NULL DEFAULT 0,
  failed_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE event_bus_delivery_attempts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES event_bus_events(id),
  subscription_id   UUID NOT NULL REFERENCES event_bus_subscriptions(id),
  status            TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  attempt           INT NOT NULL,
  duration_ms       INT NOT NULL DEFAULT 0,
  attempted_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Failure Modes & Breaking Change Policy

| Failure Mode | Detection | Mitigation |
|---|---|---|
| Subscriber lag exceeds threshold | `subscriber_lag` metric high | Scale subscriber consumers; alert operator |
| Dead-letter queue growing | `dead_letter_total` metric | Review DLQ; retry or escalate |
| Topic retention exceeded | Events auto-purged | Configure retention per topic; archive critical events |
| Publish before topic exists | `topic_not_found` error | Auto-create topics on first publish if configured |
| Delivery retries exhausted | Event transitions to DLQ | Notify operator; preserve full event payload |

**Breaking Changes:** Removing a topic is breaking for all subscribers. Changing the event schema for a topic requires a new event version; subscribers must handle both old and new versions during migration. Topic renaming requires a coordinated migration of publishers and subscribers.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `event_bus.<function>`.
* **Telemetry Metrics:**
```
blueprint_event_bus_published_total              { topic }
  blueprint_event_bus_delivered_total              { topic }
  blueprint_event_bus_dead_letter_total            { topic, reason }
  blueprint_event_bus_subscriber_lag               gauge { topic, subscription }
  blueprint_event_bus_delivery_duration_ms          histogram { topic }
  blueprint_event_bus_dlq_retry_total              { topic }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none -- infrastructure primitive)
* **Emits To:** events
* **Recommends:** audit_log, telemetry, circuit_breaker
