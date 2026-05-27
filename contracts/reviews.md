# Module Contract: `reviews`

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

---

## Part V — Real-Time and Social

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
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `reviews.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** users, orders (to verify purchase)
* **Emits To:** events
* **Recommends:** notifications, audit_log
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `created_at DESC` on `getReviews`.
