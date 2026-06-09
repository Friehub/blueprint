# Module Contract: `deployment_hooks`

**Version:** 0.1.0

---

### `deployment_hooks`
Pre-deploy health verification, post-deploy smoke testing, rollback trigger, and migration gating.

**Functions**
```
registerHook(name, hook_type, action) → Hook
runPreDeployChecks(deployment_id) → PreDeployResult
runPostDeploySmoke(deployment_id) → SmokeResult
triggerRollback(deployment_id, reason) → RollbackResult
getDeploymentStatus(deployment_id) → DeploymentStatus
getHookHistory(deployment_id?) → PaginatedResult<HookExecution>
```

**Types**
```
Hook { id, name, type: pre_deploy|post_deploy, action: http_check|migration_check|script, enabled, timeout }
PreDeployResult { deployment_id, passed: bool, checks: CheckResult[], duration_ms }
SmokeResult { deployment_id, passed: bool, checks: SmokeCheck[], duration_ms }
RollbackResult { deployment_id, triggered_at, rollback_type: full|partial, status: pending|in_progress|completed|failed }
DeploymentStatus { deployment_id, phase: deploying|pre_checks|migrating|smoke|live|rolling_back|completed|failed, checks: CheckStatus[] }
CheckResult { name, status: pass|fail|warn, detail?, duration_ms }
```

**Invariants**
- `runPreDeployChecks` must complete successfully before any schema migration or traffic cutover proceeds
- `triggerRollback` must reverse the deployment in the reverse order of application (migrations, then config, then code)
- A deployment that fails post-deploy smoke tests must be automatically eligible for rollback without manual intervention

**Providers:** custom, GitHub Actions, ArgoCD, Spinnaker, Jenkins, custom CI/CD

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Deployment phase transitions must be recorded durably

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for deployment lifecycle events.
* **Details:** Duplicate rollback triggers must not cause double-rollback; idempotency key on deployment_id.

### Worker Scaling
* **Policy:** Pre-deploy checks, smoke tests, and rollback execution must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment strategy must declare whether it is single-region, rolling-region, or blue/green cross-region.
* **Details:** A cross-region deployment must complete pre-checks in each region before proceeding to the next.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If smoke tests are queued behind other deployments, the module must report estimated wait time rather than silently delaying.

### Error Taxonomy
### Module-Specific Errors
```
runPreDeployChecks:
    check_failed:           One or more pre-deploy checks failed | fix failures and retry
    migration_gate_blocked: Migration required but not yet applied | apply pending migrations first

  triggerRollback:
    rollback_in_progress:   Rollback already active for this deployment | wait for completion
    rollback_not_available: Rollback window has expired | manual recovery required

  runPostDeploySmoke:
    smoke_test_failed:      Post-deploy smoke tests failed | rollback recommended
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
runPreDeployChecks  → deployment.pre_checks    { deployment_id, passed }
  runPostDeploySmoke → deployment.smoke_tests    { deployment_id, passed }
  triggerRollback    → deployment.rollback       { deployment_id, reason, rollback_type }
  ─                  → deployment.completed      { deployment_id, result }
  ─                  → deployment.failed         { deployment_id, phase, reason }
```

### Temporal Constraints
```
Pre-deploy check timeout:
    default:        5 minutes
    on_expiry:      mark check as failed

  Smoke test window:
    duration:       15 minutes  (time from deployment live to smoke test completion)
    on_expiry:      deployment is considered unverified; escalation triggered

  Rollback window:
    duration:       configurable, default 1 hour
    on_expiry:      rollback not available; manual recovery only
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `deployment_hooks.<function>`.
* **Telemetry Metrics:**
```
gensense_deployment_hooks_checks_total         { hook_type, status }
  gensense_deployment_hooks_deployment_duration_ms  histogram { result }
  gensense_deployment_hooks_rollbacks_total          { reason }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events
* **Recommends:** health, migrations, notifications, telemetry
