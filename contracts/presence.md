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
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `presence.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none — infrastructure primitive / wraps external provider)
* **Emits To:** events
* **Recommends:** caching, audit_log
