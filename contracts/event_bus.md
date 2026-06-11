# Module Contract: `event_bus`

**Version:** 0.1.0

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

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `event_bus.<function>`.
* **Telemetry Metrics:**
```
gensense_event_bus_published_total              { topic }
  gensense_event_bus_delivered_total              { topic }
  gensense_event_bus_dead_letter_total            { topic, reason }
  gensense_event_bus_subscriber_lag               gauge { topic, subscription }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none -- infrastructure primitive)
* **Emits To:** events
* **Recommends:** audit_log, telemetry
