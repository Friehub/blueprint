# Module Contract: `follows`

**Version:** 0.1.0

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

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Follow relationships must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for follow lifecycle events.
* **Details:** Duplicate follow events must be idempotent (upsert semantics).

### Worker Scaling
* **Policy:** Follow creation and follower/following queries must be independently scalable.

### Multi-Region Behavior
* **Mode:** Follow relationships are per-user and globally consistent.
* **Details:** A follow created in one region must be visible in all regions immediately.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If follow write throughput is saturated, new follow requests must queue or reject with `rate_limited`.

### Error Taxonomy
### Module-Specific Errors
```
follow:
    self_follow:              Cannot follow yourself | reject
    already_following:        Already following this user | return existing (idempotent)
    followee_not_found:       Target user does not exist | check user_id

  unfollow:
    not_following:            Not currently following this user | no action required
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
follow   → follows.created    { follower_id, followee_id }
unfollow → follows.deleted    { follower_id, followee_id }
```

### Temporal Constraints
```
Follow relationship:
    retention:         indefinite (until unfollow)
    on_expiry:         N/A -- follow relationships persist until explicitly removed

  Follower count cache TTL:
    default:           5 minutes
    on_expiry:         recalculate from source of truth
```

### Storage Model
* **Model:** Durable follow relationship store.
* **Details:** Follow relationships are point-in-time records. Counts may be cached but must be recalculable from source data.

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE follows (
  follower_id       UUID NOT NULL,
  followee_id       UUID NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

CREATE INDEX idx_follows_followee ON follows(followee_id, created_at DESC);
CREATE INDEX idx_follows_follower ON follows(follower_id, created_at DESC);

CREATE TABLE follow_counts (
  user_id           UUID PRIMARY KEY,
  followers         INT NOT NULL DEFAULT 0 CHECK (followers >= 0),
  following         INT NOT NULL DEFAULT 0 CHECK (following >= 0),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Failure Modes & Breaking Change Policy

| Failure Mode | Detection | Mitigation |
|---|---|---|
| Self-follow attempt | `self_follow` error | Reject immediately; no side effects |
| Duplicate follow request | `already_following` or idempotent upsert | Return existing relationship |
| Count divergence due to race | `follow_counts` out of sync with `follows` table | Periodic reconciliation job |
| Bulk unfollow causes write pressure | Throughput degradation | Rate-limit per user; queue and batch writes |

**Breaking Changes:** Changing the follow relationship model (e.g., adding bidirectional approval) is breaking and requires data migration. The `follows` table primary key change is breaking. Adding new relationship types is non-breaking.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `follows.<function>`.
* **Telemetry Metrics:**
```
gensense_follows_total                    { direction }
gensense_follows_relation_count           gauge { user_id }
gensense_follows_self_follow_rejected_total
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** users
* **Emits To:** events
* **Recommends:** notifications, audit_log
