# Module Contract: `reactions`

**Version:** 0.1.0

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
- A user can have at most one reaction of each type per subject -- enforced via UNIQUE constraint on `(user_id, subject_type, subject_id, type)`
- `addReaction` must be upsert -- calling it twice with the same parameters must not create a duplicate row; the second call must be a no-op
- `removeReaction` on a reaction that does not exist must be a no-op -- it must not error
- Reactions on a deleted subject must be removed or anonymised within the same transaction as the subject deletion (cascading delete or trigger)
- `getReactions` must return a valid summary even when no reactions exist (`total: 0`, `by_type: {}`)

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Reaction writes must be immediately visible to subsequent reads. The UNIQUE constraint on `(user_id, subject_type, subject_id, type)` prevents duplicate reactions at the database level.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for reaction events.
* **Details:** Duplicate reaction events must be idempotent (upsert on the reaction table). Removal events for already-removed reactions are no-ops.

### Worker Scaling
* **Policy:** Reaction writes and read aggregation must be independently scalable. Aggregation of `getReactions` counts may be served from materialised views or cache for high-traffic subjects.

### Multi-Region Behavior
* **Mode:** Prefer single-region for reaction data to maintain strong consistency. Cross-region deployments must use a single write region with read replicas; reaction counts may be eventually consistent across regions.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If the reaction write path is saturated, non-critical operations (like update of materialised reaction counts) may be deferred. `addReaction` and `removeReaction` must be prioritised over aggregation queries.

### Storage Model
* **Model:** Relational database (PostgreSQL) for reaction records. Materialised view or cache for aggregated counts.
* **Details:**
```sql
CREATE TABLE reactions (
    user_id         UUID NOT NULL,
    subject_type    TEXT NOT NULL,
    subject_id      UUID NOT NULL,
    type            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, subject_type, subject_id, type)
);

CREATE INDEX idx_reactions_subject ON reactions (subject_type, subject_id);
```

### Error Taxonomy
### Module-Specific Errors
```
addReaction:
    invalid_reaction_type:    The reaction type is not in the configured set | check allowed types
    subject_not_found:        The target subject does not exist | verify subject_id

  removeReaction:
    reaction_not_found:       No reaction exists for this user+subject+type | no-op (idempotent)

  getReactions:
    subject_not_found:        The target subject does not exist | return empty summary
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
addReaction       → reactions.reaction.added          { user_id, subject_type, subject_id, type }
removeReaction    → reactions.reaction.removed        { user_id, subject_type, subject_id, type }
```

### Temporal Constraints
```
Reaction record retention:
    duration:       indefinite (subject to data retention policy)
    on_expiry:      N/A -- reactions are deleted when the subject is deleted (cascade)

  Aggregation cache:
    default:        60 seconds
    on_expiry:      recalculate from persisted state
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `reactions.<function>`.
* **Telemetry Metrics:**
```
gensense_reactions_added_total                    { subject_type, type }
gensense_reactions_removed_total                  { subject_type }
gensense_reactions_by_subject_count               gauge { subject_type }
gensense_reactions_operation_duration_ms           histogram { function }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details). Reaction add/remove P99 must be < 50ms.

### Module Dependencies
* **Depends On:** users
* **Emits To:** events
* **Recommends:** notifications, audit_log, live_updates (for real-time reaction broadcast)
