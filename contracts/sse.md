# Module Contract: `sse`

**Version:** 0.1.0

---

### `sse`
Server-Sent Events stream management with reconnection, event tracking, and backpressure.

**Functions**
```
createStream(url, options?) → EventStream
subscribe(channel, handler) → StreamSubscription
unsubscribe(subscription_id) → void
sendEvent(channel, event) → void
sendEvents(channel, events) → void
closeStream(stream_id) → void
getLastEventId(channel) → string?
```

**Types**
```
EventStream { id, channels, status: connected|reconnecting|closed, last_event_id }
StreamEvent { id, type, data, retry?, event_id?, timestamp }
StreamSubscription { id, channel, handler, last_event_id, status: active|paused|closed }
ReconnectStrategy { max_attempts, backoff_ms, max_backoff_ms }
EventOptions { event_type?, id?, retry_ms? }
```

**Invariants**
- Every dispatched event must include a monotonically increasing `id` field -- the client uses `Last-Event-ID` to resume from the last received event
- On reconnection, the stream must replay all events from `Last-Event-ID` onward -- events before that ID must not be replayed
- `sendEvent` with a channel that has no active subscribers must be a no-op -- the event must not be buffered
- If a subscriber is slower than the publisher, backpressure must be applied: events must be buffered up to a configurable `max_buffer_size`, then dropped (oldest first) with a warning

**Providers:** Express, Fastify, Cloudflare Workers, custom

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** Events are delivered in order per channel; not all subscribers may receive all events under backpressure

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` per subscriber.
* **Details:** Subscribers must use `Last-Event-ID` on reconnection to avoid gaps.

### Worker Scaling
* **Policy:** Subscription management and event publishing must be independently scalable.

### Multi-Region Behavior
* **Mode:** Event streams are per-region; cross-region event bridging requires an event bus.
* **Details:** A subscriber must connect to the region that publishes the events it needs.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If a subscriber is slower than the publisher, the module must drop the oldest buffered events when the buffer exceeds `max_buffer_size`. It must not block the publisher.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. The SSE stream IS the event emission.

### Temporal Constraints
```
Reconnection backoff:
    initial:        1 second
    max:            30 seconds
    jitter:         0.5
    max_attempts:   configurable, default 10

  Event buffer:
    max_size:       configurable per channel, default 1000
    on_exceed:      drop oldest event, log warning

  Connection timeout:
    default:        5 minutes of inactivity
    on_expiry:      close connection gracefully
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `sse.<function>`.
* **Telemetry Metrics:**
```
gensense_sse_connections_total               { channel, status }
  gensense_sse_events_sent_total               { channel }
  gensense_sse_events_dropped_total             { channel, reason }
  gensense_sse_connection_duration_ms           histogram { channel }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Subscriber connection lost | Reconnect using `Last-Event-ID` and replay from last received event |
| Event buffer full | Drop oldest buffered event per channel, log warning, increment `gensense_sse_events_dropped_total` |
| Provider unavailable for stream creation | Return ProviderError, do not retry indefinitely |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** (none -- SSE is a push protocol)
* **Recommends:** live_updates, event_bus (for cross-region bridging), telemetry
