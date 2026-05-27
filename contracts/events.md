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
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `events.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none — infrastructure primitive / wraps external provider)
* **Emits To:** events
* **Recommends:** (none)
