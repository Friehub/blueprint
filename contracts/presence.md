# Module Contract: `presence`

---

### `presence`
Online/offline state tracking.

**Functions**
```
setOnline(user_id, channel?, metadata?) → void
setOffline(user_id, channel?) → void
getPresence(user_id) → PresenceState
getPresenceMultiple(user_ids) → Record<string, PresenceState>
subscribeToPresence(user_id, callback) → Unsubscribe
setCustomStatus(user_id, status) → void
```

**Types**
```
PresenceState { user_id, online, last_seen_at, channel?, custom_status? }
Unsubscribe = () => void
```

**Invariants**
- A user who disconnects without calling `setOffline` must eventually be marked offline via TTL

**Providers:** Redis Pub/Sub, Ably, Pusher, Supabase Realtime

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** Presence state converges within the TTL window

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once`
* **Details:** Presence updates may be delivered more than once; the last observed state wins.

### Worker Scaling
* **Policy:** Presence write traffic and subscribe/poll traffic must be independently scalable.
* **Details:** High-frequency presence churn must not block read queries.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether presence is single-region or active/active.
* **Details:** Duplicate presence updates across regions must converge deterministically.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If update throughput is saturated, presence writes must be coalesced or deferred predictably.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
```
Presence TTL:
    offline_timeout:   configurable per deployment
    on_expiry:         mark user offline automatically
```

### Storage Model
* **Model:** Ephemeral state store with TTL-backed records.
* **Details:** Presence state may be stored in Redis or an equivalent ephemeral store, but expiry must be enforced by the backing store or a reliable sweeper.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `presence.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none — infrastructure primitive / wraps external provider)
* **Emits To:** events
* **Recommends:** caching, audit_log
