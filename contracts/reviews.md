# Module Contract: `reviews`

**Version:** 0.1.0

---

### `reviews`
Product and seller review system.

**Functions**
```
createReview(reviewer_id, subject_type, subject_id, rating, content) → Review
getReview(review_id) → Review
getReviews(subject_type, subject_id, options?) → PaginatedResult<Review>
getAggregateRating(subject_type, subject_id) → AggregateRating
updateReview(review_id, data) → Review
deleteReview(review_id) → void
moderateReview(review_id, decision, reason?) → Review
flagReview(review_id, reason) → void
getUserReviews(user_id) → PaginatedResult<Review>
```

**Types**
```
Review { id, reviewer_id, subject_type, subject_id, rating, content, status, created_at }
AggregateRating { average, count, distribution: Record<1|2|3|4|5, number> }
ReviewStatus = pending | published | rejected | flagged
ReviewSubjectType = product | seller | service
```

**Invariants**
- A user can submit at most one review per subject -- enforced via UNIQUE constraint on `(reviewer_id, subject_type, subject_id)`
- A review's rating must be between 1 and 5 inclusive -- enforced via CHECK constraint on the `rating` column
- `moderateReview` must only transition from `pending` to `published` or `rejected`; it must not re-moderate an already-published review unless explicitly configured
- `deleteReview` must cascade to the aggregate rating recalculation -- the average must reflect the remaining reviews
- Flagged reviews must preserve the original content for audit purposes; content must not be silently removed
- `getAggregateRating` must return `{ average: 0, count: 0, distribution: {1:0,2:0,3:0,4:0,5:0} }` when no reviews exist for the subject

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Review creation, moderation decisions, and aggregate rating updates must be transactional. When a review is created or deleted, the aggregate rating must be recalculated within the same transaction, or a recalculation event must be queued immediately.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for review lifecycle events.
* **Details:** Duplicate review creation events must be idempotent (upsert on the review table). Moderation events for an already-moderated review are no-ops.

### Worker Scaling
* **Policy:** Review write operations and aggregate rating computation must be independently scalable. Aggregate ratings may be served from a materialised view or cache for high-traffic subjects.

### Multi-Region Behavior
* **Mode:** Reviews are single-region for write; read replicas may serve `getReviews` and `getAggregateRating` with bounded staleness of at most 5 seconds.
* **Details:** Moderation decisions must propagate globally before the decision is considered final.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If the review write path is saturated, moderation decisions must be prioritised over new review submissions. Aggregate rating recalculation may be deferred to a background worker.

### Storage Model
* **Model:** Relational database (PostgreSQL) for reviews and aggregate ratings.
* **Details:**
```sql
CREATE TABLE reviews (
    id              UUID PRIMARY KEY,
    reviewer_id     UUID NOT NULL REFERENCES users(id),
    subject_type    TEXT NOT NULL,
    subject_id      UUID NOT NULL,
    rating          INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    content         TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'published', 'rejected', 'flagged')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (reviewer_id, subject_type, subject_id)
);

CREATE INDEX idx_reviews_subject_status ON reviews (subject_type, subject_id, status);
```

### Error Taxonomy
### Module-Specific Errors
```
createReview:
    duplicate_review:         User has already reviewed this subject | return existing review
    not_purchased:            User has not purchased the subject | verify purchase before allowing review
    invalid_rating:           Rating must be between 1 and 5 | provide a valid rating

  getReview:
    review_not_found:         Review ID does not exist | return null

  moderateReview:
    already_moderated:        Review has already been moderated | return existing state (idempotent)
    invalid_decision:         Moderation decision must be 'published' or 'rejected' | provide a valid decision

  flagReview:
    already_flagged:          Review is already flagged | return existing state (idempotent)
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createReview      → reviews.review.created           { review_id, subject_type, subject_id, rating }
updateReview      → reviews.review.updated           { review_id, changed_fields }
deleteReview      → reviews.review.deleted           { review_id }
moderateReview    → reviews.review.moderated         { review_id, decision, reason? }
flagReview        → reviews.review.flagged           { review_id, reason }
```

### Temporal Constraints
```
Review edit window:
    default:        30 days after creation
    on_expiry:      updateReview returns review_edit_window_expired

  Flagged review auto-escalation:
    duration:       7 days without moderation action
    on_expiry:      notify moderators for review

  Aggregate rating cache:
    default:        60 seconds
    on_expiry:      recalculate from persisted state
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `reviews.<function>`.
* **Telemetry Metrics:**
```
gensense_reviews_created_total                    { subject_type, rating }
gensense_reviews_moderated_total                  { decision }
gensense_reviews_flagged_total                    { subject_type }
gensense_reviews_aggregate_rating                 gauge { subject_type }
gensense_reviews_operation_duration_ms             histogram { function }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details). Review creation P99 must be < 100ms. Aggregate rating read P99 must be < 30ms.

### Module Dependencies
* **Depends On:** users, orders (to verify purchase)
* **Emits To:** events
* **Recommends:** notifications, audit_log, moderation_queue
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `created_at DESC` on `getReviews`.
