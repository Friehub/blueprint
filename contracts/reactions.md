# Module Contract: `reactions`

---

### `reactions`
Emoji/like reactions on any entity.

**Functions**
```
addReaction(user_id, subject_type, subject_id, type) → Reaction
removeReaction(user_id, subject_type, subject_id, type) → void
getReactions(subject_type, subject_id) → ReactionSummary
getUserReaction(user_id, subject_type, subject_id) → Reaction?
getTopReacted(subject_type, options?) → ReactionLeaderboard
```

**Types**
```
Reaction { user_id, subject_type, subject_id, type, created_at }
ReactionSummary { total, by_type: Record<ReactionType, number>, user_reaction? }
ReactionType = like | love | laugh | angry | sad | fire | clap (configurable)
```

**Invariants**
- A user can have at most one reaction of each type per subject
- `addReaction` must be upsert — calling it twice must not create a duplicate

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
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `reactions.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** users
* **Emits To:** events
* **Recommends:** notifications, audit_log
