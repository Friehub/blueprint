# Module Contract: `model_evaluation`

**Version:** 0.1.0

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
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

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
gensense_model_evaluation_runs_total           { model, status }
  gensense_model_evaluation_metric_scores        gauge { model, metric }
  gensense_model_evaluation_regressions_total    { severity }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events
* **Recommends:** llm_gateway (for running evaluations against models), prompt_registry (for prompt variant eval), notifications (for regression alerts)
