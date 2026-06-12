# Module Contract: `access_governance`

**Version:** 0.1.0

---

### `access_governance`
Periodic access reviews, approval workflows, and stale access revocation.

**Functions**
```
createReview(name, scope, reviewers) → AccessReview
getReview(review_id) → AccessReview
listReviews(status?, scope?) → AccessReview[]
submitDecision(review_id, grant_id, decision, reason) → ReviewDecision
completeReview(review_id) → ReviewResult
revokeStaleAccess(review_id) → RevocationResult
scheduleRecurringReview(name, scope, config) → RecurringReview
getReviewHistory(user_id) → ReviewHistoryEntry[]
```

**Types**
```
AccessReview { id, name, scope, status: pending|in_progress|completed, reviewers[], created_at, due_at }
ReviewDecision { grant_id, user, resource, decision: approve|revoke, reason, decided_by, decided_at }
ReviewResult { review_id, total_grants, approved, revoked, no_decision, duration_ms }
RevocationResult { review_id, grants_revoked, errors[], duration_ms }
RecurringReview { id, name, scope, cadence, last_run_at, next_run_at }
ReviewHistoryEntry { review_id, date, decision, reviewer }
RecurringReviewConfig { cadence, reviewer_assignment, auto_revoke: bool, reminder_days_before }
```

**Invariants**
- A grant with no decision by the review due date must default to `revoke` if `auto_revoke` is enabled, or be flagged as `no_decision` otherwise
- `completeReview` must fail if any reviewer has pending decisions and the due date has not passed
- `revokeStaleAccess` must implement the decisions recorded in the review -- it must not make its own access decisions

**Providers:** custom, SailPoint, Okra, BetterCloud

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Review decisions must be immediately consistent to prevent race conditions with access grants

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for review lifecycle and revocation events.
* **Details:** Duplicate revocation events must be safe -- revoking an already-revoked grant is a no-op.

### Worker Scaling
* **Policy:** Review creation, decision submission, and revocation execution must be independently scalable.

### Multi-Region Behavior
* **Mode:** Access governance reviews are global; a review must cover grants across all regions.
* **Details:** Revocation commands must propagate to all regions within the maximum propagation delay.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createReview      → governance.review.created       { review_id, scope }
  submitDecision    → governance.decision.submitted   { review_id, grant_id, decision }
  completeReview    → governance.review.completed     { review_id, approved, revoked }
  revokeStaleAccess → governance.access.revoked       { review_id, grants_revoked }
```

### Temporal Constraints
```
Review due date:
    default:        14 days from creation
    on_expiry:      reviewer is escalated; auto-revoke if enabled

  Recurring review cadence:
    minimum:        30 days (quarterly recommended)
    on_due:         new review created automatically
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `access_governance.<function>`.
* **Telemetry Metrics:**
```
gensense_access_governance_reviews_total          { status }
  gensense_access_governance_decisions_total       { decision }
  gensense_access_governance_grants_revoked_total   { reason }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** permissions, audit_log
* **Emits To:** events
* **Recommends:** notifications (for reviewer reminders), users, reporting
