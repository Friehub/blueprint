# Module Contract: `health_check_advanced`

**Version:** 0.1.0

---

### `health_check_advanced`
Production health checks readiness, liveness, startup probes with dependency verification.

**Functions**
```
getLiveness() → HealthStatus
getReadiness() → HealthStatus
getStartupStatus() → HealthStatus
checkDependency(dependency_name: any) → DependencyHealth
getFullHealth() → FullHealthReport
registerHealthCheck(name: string, check_fn: any) → void
getHealthHistory(minutes: any) → HealthHistory
```

**Types**
```
HealthStatus { healthy: bool, status: ok | degraded | down, timestamp, duration_ms }
DependencyHealth { name, healthy: bool, latency_ms, last_error?, last_success_at }
FullHealthReport { service: HealthStatus, dependencies: DependencyHealth[], version, uptime_seconds, checks: HealthCheckResult[] }
HealthCheckResult { name, healthy: bool, duration_ms, last_run_at, error? }
HealthHistory { period_start, period_end, entries: TimelineEntry[] }
ProbeType = liveness | readiness | startup
```

**Invariants**
- Readiness probe must verify database connectivity and all critical dependency availability
- Liveness probe must confirm the application is not deadlocked (goroutine/thread count, event loop lag)
- Startup probe must delay readiness until initialisation is complete (migrations, cache warmup)
- Individual dependency failures must not cause cascading probe failures
- Probes must time out independently a slow DB must not block cache health checks
- Response format must follow Kubernetes spec: `{"status": "ok", "checks": [...]}`

**Providers:** Express health route, Fastify health plugin, NestJS Terminus, K8s HTTP probes

---

## System-Level Integrations & Constraints

### Observability
* **Metrics:** health_check_duration_ms, dependency_latency_ms, probe_failures_total
* **Details:** Each probe type exposes separate metrics for targeted alerting

### Failure Modes
* **Slow Dependency:** Probe times out after configured threshold, marks dependency as degraded, does not fail the entire check
* **Deadlock:** Liveness probe detects unresponsive event loop, triggers process restart via orchestrator

### Response Format
* **Liveness:** `GET /health/live` → `{"status": "ok"}` or HTTP 503
* **Readiness:** `GET /health/ready` → `{"status": "ok", "checks": [{"name": "postgres", "healthy": true, "latency_ms": 2}]}` or HTTP 503
* **Startup:** `GET /health/startup` → `{"status": "ok", "initialized": true}` or HTTP 503

### Module Dependencies
* **Hard Dependencies:** none (self-contained health check framework)
* **Soft Dependencies:** `caching` (for dependency health caching)
