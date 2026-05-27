# Module Contract: `fraud_detection`

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
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `fraud_detection.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none — wraps external provider or rules engine)
* **Emits To:** events
* **Recommends:** audit_log, ip_intelligence, rate_limiting
