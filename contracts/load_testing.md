# Module Contract: `load_testing`

**Version:** 0.1.0

---

### `load_testing`
Load test scenario definition, execution, and SLA validation.

**Functions**
```
defineScenario(name, config) → LoadScenario
getScenario(scenario_id) → LoadScenario
runScenario(scenario_id) → LoadTestRun
getRun(run_id) → LoadTestRun
cancelRun(run_id) → void
setSlaThresholds(scenario_id, thresholds) → void
validateSla(run_id) → SlaResult
compareRuns(run_ids) → ComparisonReport
```

**Types**
```
LoadScenario { id, name, stages: StageDef[], thresholds: SlaThresholds, target, protocol: http|grpc|websocket }
StageDef { name, type: ramp_up|steady|ramp_down, duration, target_rps, max_concurrent }
SlaThresholds { p50_ms, p95_ms, p99_ms, error_rate_pct, min_throughput_rps }
LoadTestRun { id, scenario_id, status, stages: StageRun[], started_at, completed_at? }
StageRun { stage, status: running|completed|failed, duration_ms, requests, p50, p95, p99, errors }
SlaResult { passed: bool, thresholds: ThresholdResult[], summary }
ThresholdResult { metric, threshold, actual, passed: bool }
ComparisonReport { runs: ComparisonRun[], winner?, recommendations }
ComparisonRun { run_id, scenario, score, metrics: MetricSummary }
```

**Invariants**
- `runScenario` must execute stages in order (ramp_up -> steady -> ramp_down) -- stage order must not be altered
- If any stage exceeds the scenario's SLA thresholds, the run must not be marked as passed -- SLA validation is per-stage and cumulative
- `cancelRun` must stop the current stage gracefully and drop subsequent stages -- it must not kill in-flight requests
- A scenario without defined `SlaThresholds` must execute but must not produce a passing or failing result for SLA-related metrics

**Providers:** k6, Locust, Artillery, Gatling, custom

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Scenario definitions must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once` for test run events.
* **Details:** Duplicate run requests must produce separate runs.

### Worker Scaling
* **Policy:** Test execution and metric aggregation must be independently scalable.

### Multi-Region Behavior
* **Mode:** Load testing is single-region by default; distributed load generation across regions must be explicitly configured.
* **Details:** A multi-region test must report per-region and aggregate results.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
runScenario        -> loadtest.run.started        { scenario_id }
  Stage completion   -> loadtest.stage.completed    { run_id, stage, requests, p95 }
                   -> loadtest.run.completed       { run_id, passed }
                   OR loadtest.run.failed          { run_id, reason }
```

### Temporal Constraints
```
Max scenario duration:
    default:        1 hour
    on_expiry:      cancel run gracefully; mark as failed

  Stage ramp up:
    min_duration:   30 seconds
    default:        2 minutes
    on_expiry:      proceed to next stage
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `load_testing.<function>`.
* **Telemetry Metrics:**
```
gensense_load_testing_runs_total               { scenario, result }
  gensense_load_testing_requests_total           { run_id, status }
  gensense_load_testing_latency                  histogram { run_id, stage }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events
* **Recommends:** reporting, telemetry, notifications
