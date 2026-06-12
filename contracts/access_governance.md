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
blueprint_access_governance_reviews_total          { status }
  blueprint_access_governance_decisions_total       { decision }
  blueprint_access_governance_grants_revoked_total   { reason }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** permissions, audit_log
* **Emits To:** events
* **Recommends:** notifications (for reviewer reminders), users, reporting

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE governance_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  scope           JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'in_progress', 'completed')),
  reviewers       UUID[] NOT NULL DEFAULT '{}',
  auto_revoke     BOOLEAN NOT NULL DEFAULT false,
  due_at          TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_governance_reviews_status ON governance_reviews(status, due_at);
CREATE INDEX idx_governance_reviews_due ON governance_reviews(due_at) WHERE status IN ('pending', 'in_progress');

CREATE TABLE governance_review_decisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id       UUID NOT NULL REFERENCES governance_reviews(id) ON DELETE CASCADE,
  grant_id        UUID NOT NULL,
  user_id         UUID NOT NULL,
  resource        TEXT NOT NULL,
  decision        TEXT NOT NULL CHECK (decision IN ('approve', 'revoke')),
  reason          TEXT,
  decided_by      UUID NOT NULL,
  decided_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (review_id, grant_id)
);

CREATE INDEX idx_governance_decisions_review ON governance_review_decisions(review_id);

CREATE TABLE governance_recurring_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  scope           JSONB NOT NULL DEFAULT '{}',
  cadence         TEXT NOT NULL CHECK (cadence IN ('monthly', 'quarterly', 'semi_annual', 'annual')),
  auto_revoke     BOOLEAN NOT NULL DEFAULT false,
  reminder_days_before INTEGER NOT NULL DEFAULT 7,
  last_run_at     TIMESTAMPTZ,
  next_run_at     TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_governance_recurring_next ON governance_recurring_reviews(next_run_at) WHERE next_run_at IS NOT NULL;

CREATE TABLE governance_review_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  review_id       UUID NOT NULL REFERENCES governance_reviews(id) ON DELETE CASCADE,
  decision        TEXT NOT NULL,
  reviewer        UUID NOT NULL,
  reviewed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_governance_history_user ON governance_review_history(user_id, reviewed_at DESC);
```

### Breaking Change Policy
- Adding new review status or decision values is additive and backward-compatible.
- Removing or renaming an existing status value requires a MAJOR version bump.
- Changing the default review due date (14 days) requires a MAJOR version bump.
- Adding new required fields to `createReview` input requires a MAJOR version bump.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Review overdue without auto-revoke | Reviewer inactive, auto_revoke=false | Escalate to next reviewer tier; notify admin after 7 days past due |
| Revocation command lost across regions | Network partition | Retry with idempotency key; reconcile on partition recovery |
| Duplicate review decision submitted | Concurrent submission by same reviewer | Enforce UNIQUE (review_id, grant_id); second call returns existing decision |
| Recurring review not created | Scheduler failure | Missed window triggers creation on next heartbeat; log gap duration |
| Grant reference already revoked | Stale grant data in review scope | Log warning; mark as already_revoked; exclude from revocation count |
