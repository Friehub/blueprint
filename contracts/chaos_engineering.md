# Module Contract: `chaos_engineering`

**Version:** 0.1.0

---

### `chaos_engineering`
Failure injection experimentation with steady-state validation, blast radius control, and automated rollback.

**Functions**
```
defineExperiment(name, hypothesis, config) → Experiment
getExperiment(experiment_id) → Experiment
listExperiments(status?) → Experiment[]
runExperiment(experiment_id) → ExperimentRun
stopExperiment(run_id) → void
injectFailure(run_id, failure) → InjectionResult
validateSteadyState(run_id) → SteadyStateResult
rollbackExperiment(run_id) → RollbackResult
scheduleExperiment(experiment_id, cron) → void
```

**Types**
```
Experiment { id, name, hypothesis, failures: FailureInjection[], steady_state: SteadyStateCheck[], blast_radius, status: draft|scheduled|running|completed|rolled_back|failed }
ExperimentRun { id, experiment_id, status, started_at, completed_at?, results: FailureResult[], rollback?: RollbackResult }
FailureInjection { type: latency|error|cpu|memory|network, target, duration_ms, intensity }
SteadyStateCheck { metric, expected_value, tolerance, duration_ms }
FailureResult { injection_id, failure, injected_at, observed_effect, resolved_at }
SteadyStateResult { passed: bool, checks: CheckResult[], violations: Violation[] }
RollbackResult { experiment_id, rolled_back_at, duration_ms, clean: bool, issues: string[] }
BlastRadius { services: string[], resources: string[], max_impact, allowed_impact: low|medium|high }
InjectionResult { experiment_id, failure, injected: bool, error? }
```

**Invariants**
- `runExperiment` must verify the steady state BEFORE any failure is injected -- the experiment must not start unless all steady state checks pass
- If any steady state check fails during the experiment, `rollbackExperiment` must be triggered automatically -- the experiment must not continue past a steady state violation
- The blast radius must be validated before injection -- the experiment must not affect services or resources outside the declared blast radius
- `stopExperiment` must immediately inject the rollback for all active failures -- stopping is not optional, it must restore the system to the pre-experiment state
- A failure injection must have a hard `duration_ms` timeout after which it is automatically reverted, even if `stopExperiment` is not called

**Dependencies:** health, telemetry

**Providers:** Chaos Mesh, Litmus, Gremlin, custom

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Experiment state must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for experiment lifecycle events.
* **Details:** Duplicate experiment runs must be idempotent (subsequent runs are separate runs).

### Worker Scaling
* **Policy:** Experiment execution, failure injection, and steady state validation must be independently scalable.

### Multi-Region Behavior
* **Mode:** Experiments run in a single region by default; cross-region experiments must be explicitly configured.
* **Details:** A cross-region experiment must not affect production traffic in one region while validation runs in another.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
### Module-Specific Errors
```
runExperiment:
    steady_state_violation:    Pre-experiment steady state check failed | fix system health before retry
    experiment_not_found:      No experiment with that ID | verify experiment_id
    blast_radius_exceeded:     Experiment targets services outside declared blast radius | narrow experiment scope

  stopExperiment:
    run_not_found:             No active run for the given run_id | verify run_id
    already_stopped:           Experiment run already stopped | no action needed

  injectFailure:
    failure_type_unsupported:  The provider does not support this failure type | use a supported type
    duration_exceeds_limit:    Requested duration exceeds max of 5 minutes | reduce duration
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
runExperiment          -> chaos.experiment.started    { experiment_id, failures_count }
  injectFailure         -> chaos.failure.injected      { experiment_id, failure_type, target }
                       -> chaos.failure.reverted      { experiment_id, failure_type, reason }
  validateSteadyState   -> chaos.steadystate.passed    { experiment_id, checks }
                       -> chaos.steadystate.failed     { experiment_id, violations }
  rollbackExperiment    -> chaos.experiment.rolled_back { experiment_id, duration_ms }
```

### Temporal Constraints
```
Failure injection max duration:
    default:        5 minutes
    on_expiry:      auto-revert the failure

  Steady state validation window:
    duration:       30 seconds (minimum observation period before and during experiment)
    on_expiry:      re-check steady state

  Experiment timeout:
    default:        30 minutes
    on_expiry:      force rollback all active failures
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `chaos_engineering.<function>`.
* **Telemetry Metrics:**
```
blueprint_chaos_engineering_experiments_total       { status }
  blueprint_chaos_engineering_failures_injected_total  { type }
  blueprint_chaos_engineering_steadystate_violations
  blueprint_chaos_engineering_rollbacks_total
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Storage Model
* **Model:** Strongly consistent experiment state store with append-only run history.
* **Details:** Experiment definitions, run state, and failure injection results must be durably persisted.

### Database Schema

#### PostgreSQL
```sql
CREATE TYPE experiment_status AS ENUM ('draft', 'scheduled', 'running', 'completed', 'rolled_back', 'failed');

CREATE TABLE chaos_experiments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  hypothesis      TEXT NOT NULL,
  blast_radius    JSONB NOT NULL DEFAULT '{}',
  allowed_impact  TEXT NOT NULL DEFAULT 'low' CHECK (allowed_impact IN ('low', 'medium', 'high')),
  status          experiment_status NOT NULL DEFAULT 'draft',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE chaos_experiment_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id   UUID NOT NULL REFERENCES chaos_experiments(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'running',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  rollback_data   JSONB
);

CREATE INDEX idx_chaos_runs_experiment ON chaos_experiment_runs(experiment_id, started_at DESC);
```

### Module Dependencies
* **Depends On:** health, telemetry
* **Emits To:** events
* **Recommends:** notifications, incident_response (for experiment-caused incidents)
