# Module Contract: `follows`

---

### `follows`
Directed follow relationships between entities.

**Functions**
```
follow(follower_id, followee_id) → FollowRelation
unfollow(follower_id, followee_id) → void
isFollowing(follower_id, followee_id) → boolean
getFollowers(user_id, options?) → PaginatedResult<User>
getFollowing(user_id, options?) → PaginatedResult<User>
getFollowCounts(user_id) → FollowCounts
getMutualFollowers(user_id_a, user_id_b) → User[]
```

**Types**
```
FollowRelation { follower_id, followee_id, created_at }
FollowCounts { followers, following }
```

**Invariants**
- `follow` must be idempotent -- following twice must not create a duplicate relation
- Self-follows must be rejected

---

## Part VI -- Platform Operations

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
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `follows.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** users
* **Emits To:** events
* **Recommends:** notifications, audit_log
