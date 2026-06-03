# Module Contract: `health`

**Version:** 0.1.0

---

### `health`
Application health checks and status reporting.

**Functions**
```
check(service?) → HealthReport
checkAll() → HealthReport
registerCheck(name, check_fn, options?) → void
getStatus() → SystemStatus
getHistory(service, options?) → HealthEvent[]
```

**Types**
```
HealthReport { status, checks: Record<string, CheckResult>, timestamp }
CheckResult { status: healthy|degraded|unhealthy, message?, latency_ms? }
SystemStatus = operational | degraded | partial_outage | major_outage
HealthEvent { service, status, message, timestamp }
```

---

## Part VII -- Security and Compliance

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
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `health.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none -- infrastructure primitive / wraps external provider)
* **Emits To:** (none)
* **Recommends:** (none)
