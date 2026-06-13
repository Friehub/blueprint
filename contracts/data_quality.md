# Module Contract: `data_quality`

**Version:** 0.2.1

---

### `data_quality`
Data quality expectation management with validation, tracking, and alerting.

**Functions**
```
defineExpectation(name, config) → Expectation
getExpectation(expectation_id) → Expectation
listExpectations(dataset?) → Expectation[]
runValidation(expectation_id, dataset) → ValidationResult
runAllValidations(dataset) → ValidationResult[]
getValidationHistory(expectation_id, options?) → PaginatedResult<ValidationRun>
getDatasetHealth(dataset) → DatasetHealth
alertOnDegradation(expectation_id, threshold) → void
```

**Types**
```
Expectation { id, name, dataset, column?, type: not_null|unique|min|max|pattern|reference_integrity|custom, config, severity: error|warning, created_at }
ValidationResult { expectation_id, passed: bool, dataset, row_count, failures: ValidationFailure[], score_pct, duration_ms }
ValidationFailure { row_id?, value, reason, severity }
ValidationRun { id, expectation_id, passed, score_pct, run_at, duration_ms }
DatasetHealth { dataset, total_expectations, passed, failed, score_pct, trend: improving|stable|degrading, last_validated_at }
AlertConfig { expectation_id, degradation_threshold_pct, notification_channel, cooldown_minutes }
```

**Invariants**
- A validation that fails on any row must produce a `passed: false` result with failure details for each failing row
- An expectation with severity `error` that fails must block data from being used in downstream consumers
- `alertOnDegradation` must not fire if the score drops below the threshold but was already below threshold on the previous run (avoid noise)

**Providers:** Great Expectations, dbt tests, Soda, Deequ, custom

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Expectation definitions must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for validation lifecycle events.
* **Details:** Duplicate validation runs must produce the same result for the same dataset snapshot.

### Worker Scaling
* **Policy:** Validation execution must be independently scalable per dataset.

### Multi-Region Behavior
* **Mode:** Quality validation runs against the data in each region; global health is aggregated from regional results.
* **Details:** A dataset that exists in multiple regions must pass validation in every region to be globally healthy.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* Validations on large datasets must be sampled or batched rather than processing all rows if the dataset exceeds the configured max_rows.

### Error Taxonomy
### Module-Specific Errors
```
defineExpectation:
    expectation_already_exists: An expectation with this name already exists for this dataset | use a different name
    invalid_config:             Expectation config is invalid or incomplete | fix Expectation config fields

  runValidation:
    expectation_not_found:      No expectation with that ID | verify expectation_id
    dataset_not_found:          Dataset not found or inaccessible | verify dataset reference
    validation_timeout:         Validation exceeded the configured timeout | reduce dataset size or increase timeout

  getDatasetHealth:
    no_expectations:            No expectations defined for this dataset | define expectations first
    dataset_not_found:          Dataset not found | verify dataset reference

  alertOnDegradation:
    already_alerted:            Alert already sent for this degradation window | cooldown not yet expired
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
runValidation     → quality.validation.completed { expectation_id, dataset, passed, score_pct }
                 OR quality.validation.failed    { expectation_id, dataset, error }
  alertOnDegradation → quality.degradation.detected { expectation_id, score_pct, threshold }
```

### Temporal Constraints
```
Validation timeout:
    default:        30 minutes (per expectation)
    on_expiry:      mark validation as failed with timeout reason

  Alert cooldown:
    duration:       1 hour
    on_expiry:      alert may fire again if still degraded
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `data_quality.<function>`.
* **Telemetry Metrics:**
```
blueprint_data_quality_validations_total          { result }
  blueprint_data_quality_score_pct                  gauge { dataset, expectation }
  blueprint_data_quality_degradation_alerts_total
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Storage Model
* **Model:** Strongly consistent expectation definitions with append-only validation history.
* **Details:** Expectation definitions and alert configurations must be immediately consistent. Validation results are append-only for trend analysis and scoring.

### Database Schema

#### PostgreSQL
```sql
CREATE TYPE expectation_severity AS ENUM ('error', 'warning');
CREATE TYPE expectation_type AS ENUM ('not_null', 'unique', 'min', 'max', 'pattern', 'reference_integrity', 'custom');

CREATE TABLE data_quality_expectations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  dataset         TEXT NOT NULL,
  column_name     TEXT,
  expectation_type expectation_type NOT NULL,
  config          JSONB NOT NULL DEFAULT '{}',
  severity        expectation_severity NOT NULL DEFAULT 'error',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, dataset)
);

CREATE TABLE data_quality_validation_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expectation_id  UUID NOT NULL REFERENCES data_quality_expectations(id) ON DELETE CASCADE,
  passed          BOOLEAN NOT NULL,
  row_count       BIGINT NOT NULL,
  failure_count   BIGINT NOT NULL DEFAULT 0,
  score_pct       REAL NOT NULL CHECK (score_pct >= 0 AND score_pct <= 100),
  duration_ms     BIGINT,
  run_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dq_runs_expectation ON data_quality_validation_runs(expectation_id, run_at DESC);

CREATE TABLE data_quality_failures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL REFERENCES data_quality_validation_runs(id) ON DELETE CASCADE,
  row_id          TEXT,
  value           TEXT,
  reason          TEXT NOT NULL,
  severity        expectation_severity NOT NULL
);

CREATE INDEX idx_dq_failures_run ON data_quality_failures(run_id);

CREATE TABLE data_quality_alert_config (
  expectation_id          UUID PRIMARY KEY REFERENCES data_quality_expectations(id) ON DELETE CASCADE,
  degradation_threshold_pct REAL NOT NULL,
  notification_channel    TEXT NOT NULL,
  cooldown_minutes        INT NOT NULL DEFAULT 60,
  last_alerted_at         TIMESTAMPTZ
);
```

### Module Dependencies
* **Depends On:** data_pipeline
* **Emits To:** events
* **Recommends:** notifications, reporting, data_catalog
