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
blockEntity(entity_type, entity_id, reason) → void
unblockEntity(entity_type, entity_id) → void
isBlocked(entity_type, entity_id) → boolean
getRiskHistory(entity_type, entity_id) → RiskScore[]
```

**Types**
```
RiskScore { score, level: low|medium|high|critical, signals, recommendation: allow|review|block }
FraudReport { id, entity_type, entity_id, reason, reporter_id, created_at }
RiskContext { ip_address, device_fingerprint?, geo?, user_agent? }
```

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
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
```
Risk history retention:
    retention:         configurable per compliance policy
    on_expiry:         archive only if allowed by policy
```

### Storage Model
* **Model:** Durable risk history store.
* **Details:** Block lists and risk scores must remain queryable for audit and review windows.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `fraud_detection.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none -- wraps external provider or rules engine)
* **Emits To:** events
* **Recommends:** audit_log, ip_intelligence, rate_limiting
