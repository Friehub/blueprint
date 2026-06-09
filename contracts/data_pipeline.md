# Module Contract: `data_pipeline`

**Version:** 0.1.0

---

### `data_pipeline`
ETL/ELT orchestration with run management, retry, and stage-level error handling.

**Functions**
```
definePipeline(name, stages, config?) → Pipeline
getPipeline(pipeline_id) → Pipeline
listPipelines() → Pipeline[]
runPipeline(pipeline_id) → PipelineRun
getRun(run_id) → PipelineRun
getRunHistory(pipeline_id, options?) → PaginatedResult<PipelineRun>
retryStage(run_id, stage) → void
pausePipeline(pipeline_id) → void
resumePipeline(pipeline_id) → void
deletePipeline(pipeline_id) → void
```

**Types**
```
Pipeline { id, name, stages: StageDef[], schedule?, status: active|paused|inactive, created_at }
StageDef { name, type: extract|transform|load, source, destination, config, retry_policy }
PipelineRun { id, pipeline_id, status: running|completed|failed|partial, stages: StageRun[], started_at, completed_at?, duration_ms }
StageRun { name, status: pending|running|completed|failed|skipped, started_at, duration_ms, error?, records_processed }
RetryPolicy { max_attempts, backoff_strategy, backoff_delay }
PipelineConfig { timeout?, notifications?, concurrency?, error_handling: abort|skip_stage|skip_record }
```

**Invariants**
- A pipeline with one or more failed stages must report status as `partial` if `error_handling` is `skip_stage`, or `failed` if `abort`
- `retryStage` must reset the stage's attempt count and re-execute from the beginning of the stage
- Stages within a pipeline must execute in definition order unless the pipeline explicitly declares parallel stages

**Providers:** Airflow, Prefect, Dagster, AWS Glue, GCP Dataflow, custom

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Pipeline definitions and runs must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for pipeline lifecycle events.
* **Details:** Duplicate pipeline runs must be prevented by run identity (idempotency_key).

### Worker Scaling
* **Policy:** Each stage must be independently scalable; worker pools should be configurable per stage type.

### Multi-Region Behavior
* **Mode:** Pipelines are typically regional; cross-region data transfer stages must declare bandwidth and latency constraints.
* **Details:** The pipeline must not transfer data across regions without explicit cross-region configuration.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If a destination is saturated, the pipeline must apply backpressure upstream rather than queuing records in memory.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
runPipeline       → pipeline.run.started        { pipeline_id, run_id }
  Stage completion  → pipeline.stage.completed    { pipeline_id, run_id, stage, records_processed }
                   OR pipeline.stage.failed       { pipeline_id, run_id, stage, error }
  Pipeline end      → pipeline.run.completed      { pipeline_id, run_id, status }
```

### Temporal Constraints
```
Pipeline timeout:
    default:        4 hours
    on_expiry:      mark run as failed; in-progress stages continue best-effort

  Stage retry backoff:
    initial:        60 seconds
    max:            30 minutes
    max_attempts:   configurable, default 3
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `data_pipeline.<function>`.
* **Telemetry Metrics:**
```
gensense_data_pipeline_runs_total              { status }
  gensense_data_pipeline_stage_duration_ms       histogram { stage_type }
  gensense_data_pipeline_records_processed_total  { pipeline_id }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events
* **Recommends:** scheduled_tasks, notifications, audit_log, reporting
