# Module Contract: `fraud_detection`

**Version:** 0.1.0

---

### `fraud_detection`
Risk scoring for transactions and user actions.

**Functions**
```
scoreTransaction(transaction, context) → RiskScore
scoreSignUp(data, context) → RiskScore
scoreLogin(user_id, context) → RiskScore
reportFraud(transaction_id, reason) → FraudReport
blockEntity(entity_type, entity_id, reason, options?) → void
unblockEntity(entity_type, entity_id) → void
isBlocked(entity_type, entity_id) → boolean
getRiskHistory(entity_type, entity_id) → RiskScore[]
submitFeedback(entity_type, entity_id, outcome, metadata) → FeedbackEvent
getFeedbackHistory(entity_type, entity_id) → FeedbackEvent[]
requestBlockReview(entity_type, entity_id, reason) → BlockReview
resolveBlockReview(review_id, decision, reason) → void
```

**Types**
```
RiskScore { score, level: low|medium|high|critical, signals, recommendation: allow|review|block }
FraudReport { id, entity_type, entity_id, reason, reporter_id, created_at }
RiskContext { ip_address, device_fingerprint?, geo?, user_agent? }
FeedbackEvent { id, entity_type, entity_id, outcome: confirmed_fraud|false_positive|incorrect_scoring, metadata, submitted_by, created_at }
BlockReview { id, entity_type, entity_id, reason, status: pending|approved|rejected, requested_by, created_at, resolved_at? }
BlockOptions { reason, expires_at?, review_required?: bool }
```

**Invariants**
- Every `blockEntity` call must specify a stated reason. Blocks created by automated scoring must be reviewable by a human operator through `requestBlockReview`.
- A `blockEntity` call without an `expires_at` or without a declared review schedule is a contract violation.
- A block created by automated scoring that is later resolved through `resolveBlockReview` must feed back into the scoring model via `submitFeedback` to improve future accuracy.

**Providers:** Sift, Sardine, custom ML, rules engine

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Standard transactional consistency

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for risk scoring side effects and block/unblock events.
* **Details:** Duplicate risk evaluations must not produce duplicate blocks.

### Worker Scaling
* **Policy:** Scoring, reporting, and block-list evaluation must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether fraud state is single-region or active/passive.
* **Details:** Block state must converge across regions before allowing a risky action.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If provider or rules-engine throughput is saturated, scoring must degrade predictably rather than silently skipping checks.

### Error Taxonomy
### Module-Specific Errors
```
scoreTransaction:
    scoring_provider_unavailable:  Scoring provider or rules engine is unavailable | degrade or block
    insufficient_context:          Not enough context data to produce reliable score | return low confidence
    transaction_exceeds_rules:     Transaction triggers too many rules | split or simplify

  blockEntity:
    entity_already_blocked:        Entity is already blocked | return existing block
    review_required:               Requested block requires human review | submit through requestBlockReview
    invalid_block_duration:        Block duration is outside allowed range | adjust expires_at

  isBlocked:
    entity_not_found:              No block record found for entity | treat as not blocked

  resolveBlockReview:
    review_not_found:              Review ID not found | check review_id
    review_already_resolved:       Review has already been decided | no action required
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
scoreTransaction → fraud.score.calculated    { entity_type, entity_id, score, level }
                  OR fraud.score.failed       { entity_type, entity_id, reason }
reportFraud     → fraud.reported             { report_id, entity_type, entity_id, reason }
blockEntity     → fraud.block.created        { entity_type, entity_id, reason, expires_at? }
unblockEntity   → fraud.block.removed        { entity_type, entity_id }
requestBlockReview → fraud.review.requested  { review_id, entity_type, entity_id }
resolveBlockReview → fraud.review.resolved   { review_id, decision }
submitFeedback  → fraud.feedback.submitted   { entity_type, entity_id, outcome }
```

### Temporal Constraints
```
Risk history retention:
    retention:         configurable per compliance policy
    on_expiry:         archive only if allowed by policy

  Block expiry:
    default:           30 days (automated blocks)
    max:               indefinite (manual blocks with review)
    on_expiry:         auto-unblock; log event

  Block review SLA:
    max_duration:      configurable, default 24 hours for auto-escalated blocks
    on_expiry:         escalate to senior operator
```

### Storage Model
* **Model:** Durable risk history store.
* **Details:** Block lists and risk scores must remain queryable for audit and review windows.

### Database Schema

#### PostgreSQL
```sql
CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE block_review_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE fraud_risk_scores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type       TEXT NOT NULL,
  entity_id         TEXT NOT NULL,
  score             NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 1),
  level             risk_level NOT NULL,
  signals           JSONB NOT NULL DEFAULT '[]',
  recommendation    TEXT NOT NULL CHECK (recommendation IN ('allow', 'review', 'block')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fraud_risk_entity ON fraud_risk_scores(entity_type, entity_id, created_at DESC);

CREATE TABLE fraud_blocks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type       TEXT NOT NULL,
  entity_id         TEXT NOT NULL,
  reason            TEXT NOT NULL,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

CREATE TABLE fraud_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type       TEXT NOT NULL,
  entity_id         TEXT NOT NULL,
  reason            TEXT NOT NULL,
  reporter_id       UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fraud_block_reviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type       TEXT NOT NULL,
  entity_id         TEXT NOT NULL,
  reason            TEXT NOT NULL,
  status            block_review_status NOT NULL DEFAULT 'pending',
  decision          TEXT,
  decision_reason   TEXT,
  requested_by      UUID,
  resolved_by       UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ
);

CREATE TABLE fraud_feedback (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type       TEXT NOT NULL,
  entity_id         TEXT NOT NULL,
  outcome           TEXT NOT NULL CHECK (outcome IN ('confirmed_fraud', 'false_positive', 'incorrect_scoring')),
  metadata          JSONB,
  submitted_by      UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Failure Modes & Breaking Change Policy

| Failure Mode | Detection | Mitigation |
|---|---|---|
| Scoring provider unavailable | `scoring_provider_unavailable` error | Degrade to local rules engine; allow with reduced confidence |
| Block persisted but scoring model not updated | Feedback loop broken | Ensure `resolveBlockReview` triggers `submitFeedback` |
| False positive blocks legitimate user | Manual review overturns block | Auto-unblock; feed back into model for improvement |
| Risk score drift over time | Model accuracy degrades | Periodic retraining; monitor score distribution |
| Feedback not consumed by model | Model stale | Alert on feedback backlog; batch process feedback |

**Breaking Changes:** Changing the `RiskScore` format (score range, signal structure) is breaking for consumers. New risk levels are non-breaking. Removing a risk level that exists in historical data is breaking. Block entity_type changes require migration of existing blocks.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `fraud_detection.<function>`.
* **Telemetry Metrics:**
```
gensense_fraud_detection_scores_total          { level, recommendation }
gensense_fraud_detection_blocks_total          { entity_type }
gensense_fraud_detection_reviews_total         { status }
gensense_fraud_detection_feedback_total        { outcome }
gensense_fraud_detection_provider_latency_ms   gauge
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none -- wraps external provider or rules engine)
* **Emits To:** events
* **Recommends:** audit_log, ip_intelligence, rate_limiting
