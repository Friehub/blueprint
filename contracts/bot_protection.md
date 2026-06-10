# Module Contract: `bot_protection`

**Version:** 0.1.0

---

### `bot_protection`
Automated traffic detection with challenge issuance and human verification scoring.

**Functions**
```
issueChallenge(endpoint, request_context) → Challenge
verifyChallenge(challenge_id, response) → ChallengeResult
scoreRequest(request_context) → BotScore
configureChallenge(endpoint, config) → void
getChallengeConfig(endpoint) → ChallengeConfig
reportBypassAttempt(endpoint, request_context) → void
```

**Types**
```
Challenge { id, method: captcha|invisible|proof_of_work, expires_at, token, metadata }
ChallengeResult { passed: bool, score: number, reason?: string }
BotScore { score, classification: human|automated|suspicious, confidence, features: string[] }
ChallengeConfig { enabled_endpoints, methods, difficulty, ttl_seconds, failure_threshold }
ChallengeMethod = captcha | invisible | proof_of_work | none
BotDetectionFeature = user_agent | rate | behavior | fingerprint | ip_reputation
```

**Invariants**
- A challenge must be required for account creation, password reset, and payment initiation when the request has not been scored as `human` with high confidence
- A failed challenge response must not advance the underlying operation -- returning a failed result must be idempotent
- Challenge bypass must not be possible through replay of a previously valid challenge token -- tokens must be single-use and expire after `ttl_seconds`
- `scoreRequest` must not block or materially delay the request -- it must complete within a per-request budget
- A request that exceeds `failure_threshold` consecutive failed challenges for the same endpoint must be escalated to `fraud_detection` for review

**Providers:** Cloudflare Turnstile, reCAPTCHA, hCaptcha, Proof of Work (custom), custom

**Dependencies:** rate_limiting, fraud_detection

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Challenge tokens and their validity state must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once` for challenge issuance and verification.
* **Details:** Challenge verification is synchronous; duplicate verification requests are idempotent.

### Worker Scaling
* **Policy:** Challenge issuance and verification must scale with request volume independently.

### Multi-Region Behavior
* **Mode:** Challenge tokens are single-region; cross-region verification requires token store replication.
* **Details:** Users should be challenged in the region closest to them.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
verifyChallenge   → bot.challenge.passed        { endpoint, score }
                 OR bot.challenge.failed        { endpoint, reason, attempt_count }
  reportBypassAttempt → bot.bypass.detected      { endpoint, request_context }
```

### Temporal Constraints
```
Challenge token TTL:
    default:        300 seconds (5 minutes)
    on_expiry:      token is invalid; user must request a new challenge

  Consecutive failure threshold:
    count:          5
    on_exceed:      escalate to fraud_detection

  Score cache TTL:
    duration:       60 seconds
    on_expiry:      re-score on next request
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `bot_protection.<function>`.
* **Telemetry Metrics:**
```
gensense_bot_protection_challenges_issued_total     { method, endpoint }
  gensense_bot_protection_challenges_passed_total     { method }
  gensense_bot_protection_challenges_failed_total      { method, reason }
  gensense_bot_protection_score_distribution            histogram
  gensense_bot_protection_bypass_reports_total
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** rate_limiting, fraud_detection
* **Emits To:** events
* **Recommends:** notifications (for bypass alerts), auth (for login challenge integration)
