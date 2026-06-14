# Module Contract: `health`

**Version:** 0.2.0

---

### `health`
Application health checks, liveness/readiness probes, and dependency status aggregation.

**Functions**
```
check(service?) → HealthReport
checkAll() → HealthReport
registerCheck(name, check_fn, options?) → void
livenessProbe() → ProbeResult
readinessProbe(expected_deps?) → ProbeResult
startupProbe() → ProbeResult
getStatus() → SystemStatus
getHistory(service, options?) → HealthEvent[]
setDependencyThreshold(dependency, threshold) → void
```

**Types**
```
HealthReport { status, checks: Record<string, CheckResult>, timestamp }
CheckResult { status: healthy|degraded|unhealthy, message?, latency_ms? }
SystemStatus = operational | degraded | partial_outage | major_outage
HealthEvent { service, status, message, timestamp }
ProbeResult { alive: bool, ready: bool, started: bool, checks: CheckResult[], dependencies: DependencyStatus[] }
DependencyStatus { name, status: healthy|degraded|unhealthy, last_checked, latency_ms }
ProbeConfig { failure_threshold, success_threshold, period_seconds, timeout_seconds }
```

**Invariants**
- `livenessProbe` must return immediately -- it must not make network calls or dependency checks. It only verifies the process is running
- `readinessProbe` must check all declared dependencies before returning `ready: true`. If any dependency is unhealthy and its failure count exceeds the configured threshold, readiness must return `ready: false`
- A dependency that has been unhealthy for longer than its configured threshold must cause the local service to report `degraded`, even if the dependency later recovers briefly
- Startup probes are required for services that take longer than 5 seconds to initialise. The startup probe runs only once -- on success, it is replaced by liveness and readiness probes

**Providers:** Kubernetes, Consul, custom health endpoint

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Health check state must be immediately consistent per instance

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once` for health check results.
* **Details:** Health checks are point-in-time snapshots; caching is not permitted.

### Worker Scaling
* **Policy:** Health checks must be lightweight per-instance; no cross-instance coordination.

### Multi-Region Behavior
* **Mode:** Health is per-region; cross-region health aggregation is a deployment orchestrator concern, not this module's responsibility.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* Health checks must not queue -- if a dependency is saturated, the check must return the current state immediately rather than waiting.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
Probe result      -> health.liveness.changed     { status }
                 OR health.readiness.changed    { status, dependencies }
                 OR health.startup.completed    { duration_ms }
  Dependency change -> health.dependency.updated  { dependency, from, to, latency_ms }
```

### Temporal Constraints
```
Liveness probe:
    period:         10 seconds
    failure_threshold: 3
    on_expiry:      process considered dead; orchestrator may restart

  Readiness probe:
    period:         15 seconds
    failure_threshold: 2
    on_expiry:      removed from load balancer rotation

  Startup probe:
    period:         5 seconds
    success_threshold: 1
    on_expiry:      process considered failed to start
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `health.<function>`.
* **Telemetry Metrics:**
```
blueprint_health_check_results_total           { check, status }
blueprint_health_dependency_status             gauge { dependency, status }
blueprint_health_probe_duration_ms              histogram { probe_type }
blueprint_health_system_status                  gauge { status }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return provider_error, do not retry indefinitely |
| Provider rate limited | Respect Retry-After header, apply exponential backoff |
| Dependency check timeout | Return degraded for that dependency rather than failing the entire probe |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise

### Module Dependencies
* **Depends On:** (none -- infrastructure primitive / wraps external provider)
* **Emits To:** events
* **Recommends:** graceful_shutdown (for readiness-driven draining), telemetry, notifications
