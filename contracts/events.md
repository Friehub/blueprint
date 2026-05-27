# Module Contract: `events`

---

### `events` (pubsub)
Internal event bus for decoupled module communication.

**Functions**
```
publish(topic, event) → void
subscribe(topic, handler) → Subscription
unsubscribe(subscription_id) → void
publishBulk(topic, events) → void
getTopics() → string[]
replay(topic, from, to, handler) → void
```

**Types**
```
Event<T> { id, topic, payload: T, timestamp, version }
Subscription { id, topic, handler }
```

**Invariants**
- `subscribe` must receive all events published after subscription, not before (unless `replay` is used)
- Event IDs must be globally unique and monotonically increasing within a topic

**Providers:** Redis Pub/Sub, Kafka, NATS, AWS EventBridge, in-process

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Standard transactional consistency

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` by default; providers may document stronger semantics if they truly support them.
* **Details:** Consumers must be idempotent and topic replay must preserve ordering within a topic partition when available.

### Worker Scaling
* **Policy:** Subscription handling, replay, and publish workloads must be independently scalable where the provider allows it.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether the bus is single-region or multi-region mirrored.
* **Details:** Cross-region duplicates must be deduplicated by event identity.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If subscriber lag or publish throughput is saturated, the bus must apply backpressure or bounded buffering rather than unbounded growth.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
```
Topic retention:
    retention:         configurable per topic or deployment
    replay_window:     must be documented by provider
```

### Storage Model
* **Model:** Partitioned event log / pubsub transport.
* **Details:** The provider must document ordering guarantees, partitioning behavior, and replay retention.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `events.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none -- infrastructure primitive / wraps external provider)
* **Emits To:** events
* **Recommends:** (none)
