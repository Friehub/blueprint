# Module Contract: `live_updates`

**Version:** 0.1.0

---

### `live_updates`
Real-time resource change subscriptions with delta push, reconnect handling, and lifecycle management.

**Functions**
```
subscribe(resource_type, filter, handler) → Subscription
unsubscribe(subscription_id) → void
getSubscriptions(user_id?) → Subscription[]
pushUpdate(resource_type, resource_id, delta) → void
broadcast(resource_type, delta, filter?) → void
reconnect(subscription_id, last_event_id) → void
getSubscriptionStatus(subscription_id) → SubscriptionStatus
```

**Types**
```
Subscription { id, user_id, resource_type, filter, handler, status: active|reconnecting|paused, created_at }
UpdateDelta { resource_type, resource_id, event: created|updated|deleted, data, version, timestamp }
SubscriptionStatus { id, status, connected_at, last_event_id, events_received, bytes_received }
ReconnectOptions { last_event_id, batch_size, since }
```

**Invariants**
- `pushUpdate` must deliver the delta to all active subscriptions matching the resource type and filter
- `reconnect` must replay missed events starting from `last_event_id` -- no events before that ID must be replayed
- A subscription that fails to acknowledge heartbeats within the timeout must be marked as `reconnecting`

**Providers:** WebSocket, SSE, Phoenix Channels, Socket.IO, custom

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** Updates are delivered asynchronously; event order within a resource is preserved

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for pushed updates.
* **Details:** Consumers must be idempotent; the same event may be delivered on reconnect.

### Worker Scaling
* **Policy:** Subscription management, update publishing, and connection handling must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether real-time updates are single-region or multi-region with cross-region bridging.
* **Details:** A user connected to region A must receive updates published in region B.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If a subscriber cannot keep up, the module must buffer up to a configurable limit and then apply backpressure rather than dropping updates.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
subscribe         → updates.subscription.created { resource_type, subscription_id }
  pushUpdate        → updates.delta.pushed         { resource_type, resource_id, event }
  unsubscribe       → updates.subscription.removed  { subscription_id }
```

### Temporal Constraints
```
Heartbeat interval:
    server:         30 seconds
    client:         35 seconds (must tolerate one missed server heartbeat)
    on_expiry:      mark subscription as reconnecting; attempt reconnect

  Event replay window:
    duration:       5 minutes
    on_expiry:      events are evicted; reconnect from newer events only
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `live_updates.<function>`.
* **Telemetry Metrics:**
```
gensense_live_updates_active_subscriptions_total    { resource_type }
  gensense_live_updates_deltas_pushed_total          { resource_type, event }
  gensense_live_updates_subscription_duration_ms      histogram
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** presence
* **Emits To:** events
* **Recommends:** event_bus, messaging
