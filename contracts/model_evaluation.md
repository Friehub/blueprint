# Module Contract: `model_evaluation`

**Version:** 0.2.1

---

### `model_evaluation`
Systematic evaluation of model quality with datasets, metrics, and regression detection.

**Functions**
```
createEvaluation(name, config) → Evaluation
getEvaluation(eval_id) → Evaluation
listEvaluations(model?) → EvaluationSummary[]
runEvaluation(eval_id) → EvalRun
getRunResults(run_id) → EvalRunResults
getMetricHistory(eval_id, metric) → MetricPoint[]
registerMetric(name, calculator) → void
setBaseline(eval_id, run_id) → void
detectRegression(eval_id, metric) → RegressionReport?
```

**Types**
```
Evaluation { id, name, model, dataset, metrics: EvalMetric[], baseline_run_id?, created_at }
EvaluationSummary { id, name, model, metric_count, last_run_at?, last_score?, trend: improving|stable|regressing }
EvalRun { id, eval_id, status: pending|running|completed|failed, started_at, completed_at, duration_ms }
EvalRunResults { run_id, eval_id, metrics: MetricResult[], summary: MetricSummary, passed }
EvalMetric { name, description, higher_is_better: bool, threshold? }
MetricResult { name, value, unit, samples, passed }
MetricSummary { overall_score, metrics_passed, metrics_failed, total_metrics }
MetricPoint { eval_id, metric, value, run_id, timestamp }
RegressionReport { eval_id, metric, baseline_value, current_value, delta, severity: minor|major|critical, recommended_action }
EvalConfig { model, dataset_id, metrics, split?, max_samples?, timeout? }
```

**Invariants**
- `runEvaluation` must produce a complete metric set or fail entirely -- partial results must not be reported
- `detectRegression` must only produce a report when a baseline exists and the delta exceeds the threshold
- A run that takes longer than the configured `timeout` must be marked as failed, not silently abandoned

**Providers:** custom, LangSmith, MLflow, Weights & Biases, DeepEval, RAGAS

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Evaluation metadata and baseline references must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for evaluation lifecycle events.
* **Details:** Duplicate run submissions must be deduplicated by run identity.

### Worker Scaling
* **Policy:** Evaluation execution, metric computation, and historical analysis must be independently scalable.

### Multi-Region Behavior
* **Mode:** Evaluation datasets and results may be regional; cross-region comparison is a read-only operation.
* **Details:** Baseline runs must be from the same model version and dataset to be comparable.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* Evaluation runs against LLM backends must use the llm_gateway module and inherit its backpressure and fallback behavior.

### Error Taxonomy
### Module-Specific Errors
```
runEvaluation:
    eval_not_found:           Evaluation ID does not exist | verify eval_id
    eval_already_running:     Evaluation run is already in progress | wait for completion
    dataset_not_found:        Dataset referenced in evaluation not found | verify dataset_id
    model_unavailable:        Model is not responding | retry or use fallback model

  detectRegression:
    no_baseline_set:          No baseline run configured for this evaluation | call setBaseline first
    baseline_stale:           Baseline run is older than stale threshold (7 days) | run fresh baseline
    metric_not_found:         Metric not registered for this evaluation | call registerMetric first
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createEvaluation  → eval.created                { eval_id, name, model }
  runEvaluation    → eval.run.started             { eval_id, run_id }
                 → eval.run.completed            { eval_id, run_id, overall_score, passed }
                 OR eval.run.failed              { eval_id, run_id, reason }
  detectRegression → eval.regression_detected    { eval_id, metric, delta, severity }
```

### Temporal Constraints
```
Evaluation run timeout:
    default:        30 minutes
    on_expiry:      mark run as failed with timeout reason

  Baseline stale threshold:
    duration:       7 days
    on_expiry:      baseline is considered stale; regression detection warns of stale comparison
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `model_evaluation.<function>`.
* **Telemetry Metrics:**
```
blueprint_model_evaluation_runs_total           { model, status }
blueprint_model_evaluation_metric_scores        gauge { model, metric }
blueprint_model_evaluation_regressions_total    { severity }
blueprint_model_evaluation_run_duration_ms      histogram { model }
blueprint_model_evaluation_active_runs          gauge
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return provider_error, do not retry indefinitely |
| Provider rate limited | Respect Retry-After header, apply exponential backoff |
| Evaluation timeout exceeded | Mark run as failed with timeout reason |
| Model returns error during eval | Log error for the sample, continue with remaining samples |
| Baseline stale | Return baseline_stale warning; regression detection reports degraded confidence |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new metric: non-breaking
- Changing baseline comparison algorithm: breaking — existing regressions must be re-evaluated

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events
* **Recommends:** llm_gateway (for running evaluations against models), prompt_registry (for prompt variant eval), notifications (for regression alerts)
