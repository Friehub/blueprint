# Module Contract: `typing_indicators`

**Version:** 0.1.0

---

### `typing_indicators`
Real-time typing state broadcast with expiry and channel scoping.

**Functions**
```
startTyping(channel, user_id) → void
stopTyping(channel, user_id) → void
getTypingUsers(channel) → TypingUser[]
subscribeTyping(channel, handler) → TypingSubscription
unsubscribeTyping(subscription_id) → void
setTypingTimeout(channel, duration_ms) → void
```

**Types**
```
TypingUser { user_id, channel, started_at, expires_at, is_stale }
TypingSubscription { id, channel, handler, status: active|paused }
```

**Invariants**
- A user who has not sent a `startTyping` heartbeat within the timeout must be automatically expired from the typing list
- `stopTyping` must immediately remove the user from the typing indicator list -- it must not wait for expiry
- A user must not appear in the typing list for a channel they are not a participant of

**Providers:** custom (WebSocket), Presence (Liveblocks, Ably, Pusher)

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** Typing state is ephemeral and eventually consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once` for typing state broadcasts.
* **Details:** If a typing indicator is not delivered, the next heartbeat or expiry will correct the state.

### Worker Scaling
* **Policy:** Typing state management must be lightweight and per-channel scalable.

### Multi-Region Behavior
* **Mode:** Typing state is per-region; cross-region typing requires channel bridging.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Typing indicators are ephemeral and do not emit durable events.

### Temporal Constraints
```
Typing timeout:
    default:        5000ms
    on_expiry:      remove user from typing list automatically

  Heartbeat interval:
    client:         3000ms (must be less than timeout)
    on_miss:        treat as stopTyping
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `typing_indicators.<function>`.
* **Telemetry Metrics:**
```
blueprint_typing_indicators_active_users_total    { channel }
  blueprint_typing_indicators_heartbeats_total     { channel }
  blueprint_typing_indicators_expirations_total
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Presence backend unreachable | Return ProviderError, caller should retry; stale typing state expires via timeout |
| WebSocket connection lost | Client must reconnect and re-send `startTyping` for active channels |
| Heartbeat storm (rapid start/stop) | Module must throttle to at most 1 update per 200ms per channel per user |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise

### Module Dependencies
* **Depends On:** presence, messaging
* **Emits To:** (none -- ephemeral state only)
* **Recommends:** live_updates
