# Module Contract: `content_safety`

**Version:** 0.1.0

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
Policy = hate_speech | harassment | violence | self_harm | sexual | spam | misinformation | illegal
```

**Invariants**
- `checkContent` must never return `safe: true` when any active policy decision has `passed: false`
- A violation reported by the `automated` source must be reviewed by a human before it is permanently resolved
- `appealViolation` on a violation that is already under appeal must return the existing appeal, not create a duplicate

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
gensense_content_safety_checks_total            { policy, result }
  gensense_content_safety_violations_total        { category, source }
  gensense_content_safety_appeals_total            { decision }
  gensense_content_safety_classification_latency_ms  histogram
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** moderation
* **Emits To:** events
* **Recommends:** audit_log, notifications, llm_gateway (for AI-generated content checks)
