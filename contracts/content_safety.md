# Module Contract: `content_safety`

**Version:** 0.2.0

---

### `content_safety`
Content policy enforcement with classification, moderation logging, and appeal workflows.

**Functions**
```
checkContent(content, options?) → SafetyVerdict
classifyContent(content) → ContentClassification
reportViolation(content_id, reason) → ViolationReport
getViolation(violation_id) → ViolationReport
getModerationHistory(content_id) → ModerationEntry[]
appealViolation(violation_id, reason) → Appeal
resolveAppeal(appeal_id, decision) → AppealResolution
getSafetyStats() → SafetyStats
```

**Types**
```
SafetyVerdict { safe: bool, decisions: PolicyDecision[], overall_risk: low|medium|high, recommended_action }
PolicyDecision { policy, passed: bool, risk_score, reason, details }
ContentClassification { categories: CategoryScore[], primary_category, secondary_categories[] }
CategoryScore { category, score, threshold, flagged }
ViolationReport { id, content_id, content_type, reason, category, reported_by: automated|user|reviewer, status: open|under_review|resolved|appealed, created_at }
ModerationEntry { id, content_id, action: approved|flagged|blocked|appealed, reviewer?, reason, created_at }
Appeal { id, violation_id, reason, evidence?, status: pending|approved|rejected, created_at }
AppealResolution { appeal_id, decision: approved|rejected, reviewer, reason, resolved_at }
SafetyStats { total_checked, total_flagged, total_blocked, appeals_filed, appeals_upheld, appeals_rejected }
SafetyOptions { policies?: string[], threshold?, include_explanation?, mode: sync|async }
Policy = hate_speech | harassment | violence | self_harm | sexual | spam | misinformation | illegal | prompt_injection
```

**Invariants**
- `checkContent` must never return `safe: true` when any active policy decision has `passed: false`
- A violation reported by the `automated` source must be reviewed by a human before it is permanently resolved
- `appealViolation` on a violation that is already under appeal must return the existing appeal, not create a duplicate
- Any content passed to `llm_gateway` functions must be screened by `checkContent` with the `prompt_injection` policy enabled before it is used as part of a prompt

**Providers:** OpenAI Moderation API, Perspective API, Azure Content Safety, AWS Comprehend, custom classifier

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Violation records and appeal state must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for moderation lifecycle events.
* **Details:** Duplicate moderation checks on the same content must return the same result.

### Worker Scaling
* **Policy:** Content classification, human review queue, and appeal processing must be independently scalable.

### Multi-Region Behavior
* **Mode:** Content safety policies may differ by region; the module must apply the policy set for the content's jurisdiction.
* **Details:** Appeal decisions are jurisdiction-specific and must not cross regions without explicit review.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If the moderation API is saturated, `checkContent` must fall back to a local classifier or a cached decision rather than blocking the caller.

### Error Taxonomy
### Module-Specific Errors
```
checkContent:
    classification_unavailable:  Moderation service is down or unreachable | use cached or lenient fallback
    content_too_long:            Content exceeds maximum classification length | split before checking

  appealViolation:
    appeal_window_expired:       Appeal period has passed | contact support
    already_resolved:            Violation is already resolved and not eligible for appeal | check resolution reason
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
checkContent     → safety.content.checked      { content_id, safe, risk }
  reportViolation  → safety.violation.reported   { violation_id, category }
  appealViolation  → safety.appeal.filed          { appeal_id, violation_id }
  resolveAppeal    → safety.appeal.resolved       { appeal_id, decision }
```

### Temporal Constraints
```
Appeal window:
    duration:       14 days from violation creation
    on_expiry:      violation is final; not eligible for appeal

  Automated review timeout:
    duration:       24 hours  (max time for automated flag to receive human review)
    on_expiry:      escalate to supervisory review

  Policy cache TTL:
    duration:       5 minutes  (cached classification results for identical content)
    on_expiry:      re-classify on next check
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `content_safety.<function>`.
* **Telemetry Metrics:**
```
blueprint_content_safety_checks_total            { policy, result }
  blueprint_content_safety_violations_total        { category, source }
  blueprint_content_safety_appeals_total            { decision }
  blueprint_content_safety_classification_latency_ms  histogram
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Storage Model
* **Model:** Strongly consistent violation and appeal record store.
* **Details:** Violation reports, moderation history, and appeals must be durably persisted for audit. Classification results may be cached ephemerally with a TTL.

### Database Schema

#### PostgreSQL
```sql
CREATE TYPE violation_status AS ENUM ('open', 'under_review', 'resolved', 'appealed');
CREATE TYPE violation_source AS ENUM ('automated', 'user', 'reviewer');
CREATE TYPE appeal_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE content_safety_violations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id      TEXT NOT NULL,
  content_type    TEXT NOT NULL,
  reason          TEXT NOT NULL,
  category        TEXT NOT NULL,
  source          violation_source NOT NULL,
  status          violation_status NOT NULL DEFAULT 'open',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_safety_violations_status ON content_safety_violations(status) WHERE status IN ('open', 'under_review');
CREATE INDEX idx_safety_violations_content ON content_safety_violations(content_id);

CREATE TABLE content_safety_appeals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  violation_id    UUID NOT NULL REFERENCES content_safety_violations(id) ON DELETE CASCADE,
  reason          TEXT NOT NULL,
  evidence        TEXT,
  status          appeal_status NOT NULL DEFAULT 'pending',
  reviewer        TEXT,
  resolution_note TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX idx_safety_appeals_status ON content_safety_appeals(status) WHERE status = 'pending';
```

### Module Dependencies
* **Depends On:** moderation
* **Emits To:** events
* **Recommends:** audit_log, notifications, llm_gateway (for AI-generated content checks)
