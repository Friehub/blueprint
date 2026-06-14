# Module Contract: `data_pipeline`

**Version:** 0.2.1

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
### Module-Specific Errors
```
definePipeline:
    pipeline_already_exists:   A pipeline with this name already exists | use a different name
    invalid_stage_definition:  Stage definition has missing or invalid fields | fix StageDef entries

  runPipeline:
    pipeline_not_found:        No pipeline with that ID | verify pipeline_id
    pipeline_paused:           Pipeline is paused | resume before running
    run_already_in_progress:   A run is already in progress for this pipeline | wait for completion

  retryStage:
    run_not_found:             No run with that ID | verify run_id
    stage_not_failed:          Stage did not fail; only failed stages can be retried | check stage status
    max_retries_exceeded:      Stage has exhausted its retry policy | manual intervention required

  pausePipeline:
    already_paused:            Pipeline is already paused | no action needed

  deletePipeline:
    pipeline_not_found:        No pipeline with that ID | verify pipeline_id
    pipeline_has_active_runs:  Pipeline has active runs | stop runs before deleting
```

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
blueprint_data_pipeline_runs_total              { status }
  blueprint_data_pipeline_stage_duration_ms       histogram { stage_type }
  blueprint_data_pipeline_records_processed_total  { pipeline_id }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Storage Model
* **Model:** Strongly consistent pipeline definition and run state store with append-only run history.
* **Details:** Pipeline definitions and active run state must be immediately consistent. Run history is append-only for audit and retry purposes.

### Database Schema

#### PostgreSQL
```sql
CREATE TYPE pipeline_status AS ENUM ('active', 'paused', 'inactive');
CREATE TYPE pipeline_run_status AS ENUM ('running', 'completed', 'failed', 'partial');
CREATE TYPE stage_type AS ENUM ('extract', 'transform', 'load');

CREATE TABLE data_pipelines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,
  stages          JSONB NOT NULL,
  schedule        TEXT,
  status          pipeline_status NOT NULL DEFAULT 'active',
  config          JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE data_pipeline_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID NOT NULL REFERENCES data_pipelines(id) ON DELETE CASCADE,
  status          pipeline_run_status NOT NULL DEFAULT 'running',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  duration_ms     BIGINT
);

CREATE INDEX idx_pipeline_runs_pipeline ON data_pipeline_runs(pipeline_id, started_at DESC);
CREATE INDEX idx_pipeline_runs_status ON data_pipeline_runs(status) WHERE status = 'running';

CREATE TABLE data_pipeline_stage_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL REFERENCES data_pipeline_runs(id) ON DELETE CASCADE,
  stage_name      TEXT NOT NULL,
  stage_type      stage_type NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  started_at      TIMESTAMPTZ,
  duration_ms     BIGINT,
  records_processed BIGINT DEFAULT 0,
  error           TEXT
);

CREATE INDEX idx_pipeline_stage_runs_run ON data_pipeline_stage_runs(run_id);
```

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events
* **Recommends:** scheduled_tasks, notifications, audit_log, reporting
