# Module: ab_testing

**Version:** 0.1.0
**Part:** III -- Data and State

## Purpose

Defines the interface for running controlled experiments on a live system. An experiment assigns subjects (users, sessions, or anonymous visitors) to variants, tracks exposure, collects metric observations, and determines statistical significance. This module is distinct from `feature_flags`, which manages simple boolean toggles without statistical analysis or variant assignment guarantees. Every experiment in this module is a hypothesis with a measurable outcome.

---

## State Machine

```
DRAFT → RUNNING → PAUSED → RUNNING
                → STOPPED → CONCLUDED
                           → ARCHIVED
DRAFT → ARCHIVED
```

Transitions:
- `DRAFT → RUNNING`: `startExperiment` called; assignment begins immediately
- `RUNNING → PAUSED`: `pauseExperiment` called; subjects retain their assigned variant but no new assignments occur
- `PAUSED → RUNNING`: `resumeExperiment` called
- `RUNNING → STOPPED`: `stopExperiment` called or `endDate` reached; no new assignments; metric collection continues for in-flight subjects
- `STOPPED → CONCLUDED`: `concludeExperiment` called with a winning variant decision
- `STOPPED | RUNNING → ARCHIVED`: experiment soft-deleted

---

## Functions

### `createExperiment(input: CreateExperimentInput) → Experiment`
Defines a new experiment with its hypothesis, variants, traffic allocation, and target metrics. Does not start assignment.

### `startExperiment(experimentId: ExperimentId) → Experiment`
Transitions the experiment to `RUNNING`. Validates that variant allocations sum to 100%.

### `pauseExperiment(experimentId: ExperimentId) → Experiment`
Halts new variant assignments. Existing assignments are preserved.

### `resumeExperiment(experimentId: ExperimentId) → Experiment`
Resumes new variant assignments.

### `stopExperiment(experimentId: ExperimentId) → Experiment`
Ends the experiment. No new assignments. Returns the experiment with current metric snapshots.

### `concludeExperiment(input: ConcludeExperimentInput) → Experiment`
Records the winning variant decision and any analysis notes. Transitions to `CONCLUDED`.

### `getExperiment(experimentId: ExperimentId) → Experiment`
Returns the full experiment definition, current status, and metric summary.

### `listExperiments(input: ListExperimentsInput) → PaginatedList<Experiment>`
Returns experiments filtered by status, target metric, or date range.

### `assignVariant(input: AssignVariantInput) → VariantAssignment`
Assigns a subject to a variant deterministically based on the experiment's allocation strategy. If the subject is already assigned, returns the existing assignment. This is the hot-path operation -- it must be sub-millisecond.

### `getAssignment(experimentId: ExperimentId, subjectId: string) → VariantAssignment`
Returns the current variant assignment for a subject in an experiment. Returns `SUBJECT_NOT_ASSIGNED` if the subject has not been enrolled.

### `recordExposure(input: RecordExposureInput) → void`
Logs that a subject was actually exposed to their assigned variant (saw the change in the UI or received the treatment). Exposure is distinct from assignment.

### `recordMetric(input: RecordMetricInput) → void`
Records a metric observation (e.g., conversion, click, revenue) for a subject within an experiment. Used to compute experiment results.

### `getResults(experimentId: ExperimentId) → ExperimentResults`
Returns current statistical results per variant: conversion rates, confidence intervals, p-values, and a significance determination.

---

## Types

```typescript
type ExperimentId = string;
type VariantId = string;

type ExperimentStatus = "DRAFT" | "RUNNING" | "PAUSED" | "STOPPED" | "CONCLUDED" | "ARCHIVED";

type AllocationStrategy = "RANDOM" | "DETERMINISTIC_HASH" | "STICKY_SESSION";

type Variant = {
  variantId: VariantId;
  name: string;                    // e.g. "control", "treatment_a"
  description?: string;
  allocationPercent: number;       // Must sum to 100 across all variants
  isControl: boolean;
};

type TargetMetric = {
  name: string;                    // e.g. "checkout_conversion", "revenue_per_user"
  type: "BINARY" | "CONTINUOUS";  // BINARY = converted/not; CONTINUOUS = revenue amount
  isPrimary: boolean;              // Only one primary metric per experiment
};

type CreateExperimentInput = {
  name: string;
  hypothesis: string;
  variants: Variant[];
  targetMetrics: TargetMetric[];
  allocationStrategy: AllocationStrategy;
  trafficPercent: number;          // Percent of eligible subjects enrolled (0--100)
  eligibilityCriteria?: Record<string, unknown>; // e.g. { country: "US", plan: "pro" }
  startDate?: Timestamp;
  endDate?: Timestamp;
};

type Experiment = CreateExperimentInput & {
  experimentId: ExperimentId;
  status: ExperimentStatus;
  winningVariantId?: VariantId;
  conclusionNotes?: string;
  createdAt: Timestamp;
  startedAt?: Timestamp;
  stoppedAt?: Timestamp;
  concludedAt?: Timestamp;
};

type VariantAssignment = {
  experimentId: ExperimentId;
  subjectId: string;
  variantId: VariantId;
  variantName: string;
  assignedAt: Timestamp;
  exposed: boolean;
};

type AssignVariantInput = {
  experimentId: ExperimentId;
  subjectId: string;
  subjectAttributes?: Record<string, unknown>;
};

type RecordExposureInput = {
  experimentId: ExperimentId;
  subjectId: string;
  exposedAt?: Timestamp;
};

type RecordMetricInput = {
  experimentId: ExperimentId;
  subjectId: string;
  metricName: string;
  value: number;                   // 1/0 for BINARY; numeric for CONTINUOUS
  recordedAt?: Timestamp;
};

type VariantResult = {
  variantId: VariantId;
  variantName: string;
  subjectsAssigned: number;
  subjectsExposed: number;
  conversions: number;
  conversionRate: number;
  meanValue?: number;
  confidenceIntervalLow: number;
  confidenceIntervalHigh: number;
  relativeUplift?: number;         // Relative to control variant
  pValue?: number;
  isStatisticallySignificant: boolean;
};

type ExperimentResults = {
  experimentId: ExperimentId;
  primaryMetric: string;
  minimumDetectableEffect: number;
  requiredSampleSize: number;
  currentSampleSize: number;
  computedAt: Timestamp;
  variants: VariantResult[];
  hasSignificantWinner: boolean;
  recommendedWinnerVariantId?: VariantId;
};

type ConcludeExperimentInput = {
  experimentId: ExperimentId;
  winningVariantId: VariantId;
  conclusionNotes?: string;
};

type ListExperimentsInput = {
  status?: ExperimentStatus;
  primaryMetric?: string;
  pagination: PaginationInput;
};
```

---

## Invariants

1. Variant `allocationPercent` values must sum to exactly 100; `startExperiment` returns `INVALID_ALLOCATION` if they do not.
2. Exactly one variant must have `isControl = true`; experiments with zero or multiple control variants are rejected at creation.
3. Exactly one metric must have `isPrimary = true`.
4. `assignVariant` must be idempotent on `(experimentId, subjectId)`; a subject's variant never changes once assigned.
5. `recordMetric` observations are only accepted for subjects who have a recorded exposure; unexposed subjects' metrics are discarded to prevent novelty bias.
6. An experiment in `PAUSED` or `STOPPED` state must not generate new variant assignments.
7. `concludeExperiment` requires that `winningVariantId` corresponds to a variant defined in the experiment.
8. Statistical significance is computed server-side; clients receive only computed results, never raw observation data.

---

## Events Emitted

- `experiment.created`
- `experiment.started`
- `experiment.paused`
- `experiment.resumed`
- `experiment.stopped`
- `experiment.concluded` -- includes `winningVariantId`
- `experiment.variant.assigned` -- includes `subjectId`, `variantId`
- `experiment.variant.exposed`

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Experiment state transitions, variant assignments, and exposure records must be immediately consistent. Metric observations may be eventually consistent (≤ 5 seconds lag).

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for experiment lifecycle events and metric observations.
* **Details:** Duplicate assignment events must be idempotent on `(experimentId, subjectId)`.

### Worker Scaling
* **Policy:** Experiment assignment (hot path), metric ingestion (async), and statistical computation must be independently scalable.

### Multi-Region Behavior
* **Mode:** Experiment definitions are global; assignment and exposure records are region-local.
* **Details:** A subject must be assigned to the same variant regardless of region. `DETERMINISTIC_HASH` allocation strategy ensures cross-region consistency.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Required Functions:**
  - `assignVariant(input, idempotency_key?)`
  - `recordExposure(input, idempotency_key?)`
  - `recordMetric(input, idempotency_key?)`

### Backpressure
* If `assignVariant` capacity is saturated (hot-path), the module must degrade gracefully by reading from the assignment cache and deferring write-back. `recordMetric` may buffer and batch under load.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).
* Domain errors: `EXPERIMENT_NOT_FOUND`, `EXPERIMENT_NOT_RUNNING`, `INVALID_ALLOCATION`, `SUBJECT_NOT_ASSIGNED`, `METRIC_NOT_DEFINED`, `VARIANT_NOT_FOUND`, `EXPERIMENT_NOT_STOPPABLE`, `EXPERIMENT_ALREADY_CONCLUDED`, `INVALID_TRANSITION`.

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
experiment.created
experiment.started
experiment.paused
experiment.resumed
experiment.stopped
experiment.concluded           { winningVariantId }
experiment.variant.assigned    { subjectId, variantId }
experiment.variant.exposed     { subjectId, variantId }
experiment.metric.recorded     { subjectId, metricName, value }
```

### Temporal Constraints
```
Experiment:
    max_duration:       90 days (running)
    on_expiry:          auto-stop after max_duration; emit experiment.stopped

    pause_max_duration: 30 days
    on_expiry:          auto-stop; subjects retain assignment

    data_retention:     365 days after conclusion
    on_expiry:          eligible for anonymisation; aggregate results preserved
```

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE ab_experiments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  hypothesis         TEXT,
  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'running', 'paused', 'stopped', 'concluded', 'archived')),
  allocation_strategy TEXT NOT NULL DEFAULT 'DETERMINISTIC_HASH'
                      CHECK (allocation_strategy IN ('RANDOM', 'DETERMINISTIC_HASH', 'STICKY_SESSION')),
  traffic_percent   INTEGER NOT NULL CHECK (traffic_percent BETWEEN 0 AND 100),
  eligibility_criteria JSONB DEFAULT '{}',
  winning_variant_id UUID,
  conclusion_notes  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at        TIMESTAMPTZ,
  stopped_at        TIMESTAMPTZ,
  concluded_at      TIMESTAMPTZ
);

CREATE INDEX idx_ab_experiments_status ON ab_experiments(status, created_at DESC);

CREATE TABLE ab_variants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id     UUID NOT NULL REFERENCES ab_experiments(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  description       TEXT,
  allocation_percent INTEGER NOT NULL CHECK (allocation_percent BETWEEN 0 AND 100),
  is_control        BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (experiment_id, is_control) WHERE is_control = true
);

CREATE INDEX idx_ab_variants_experiment ON ab_variants(experiment_id);

CREATE TABLE ab_target_metrics (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id     UUID NOT NULL REFERENCES ab_experiments(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  metric_type       TEXT NOT NULL CHECK (metric_type IN ('BINARY', 'CONTINUOUS')),
  is_primary        BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (experiment_id, name)
);

CREATE UNIQUE INDEX idx_ab_metrics_one_primary ON ab_target_metrics(experiment_id) WHERE is_primary = true;

CREATE TABLE ab_assignments (
  experiment_id     UUID NOT NULL REFERENCES ab_experiments(id) ON DELETE CASCADE,
  subject_id        TEXT NOT NULL,
  variant_id        UUID NOT NULL REFERENCES ab_variants(id),
  assigned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  exposed           BOOLEAN NOT NULL DEFAULT false,
  exposed_at        TIMESTAMPTZ,
  PRIMARY KEY (experiment_id, subject_id)
);

CREATE INDEX idx_ab_assignments_variant ON ab_assignments(variant_id);

CREATE TABLE ab_metric_observations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id     UUID NOT NULL REFERENCES ab_experiments(id) ON DELETE CASCADE,
  subject_id        TEXT NOT NULL,
  metric_name       TEXT NOT NULL,
  value             NUMERIC(19,4) NOT NULL,
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ab_observations_experiment ON ab_metric_observations(experiment_id, metric_name, recorded_at);
```

### Storage Model
* **Model:** Durable experiment metadata and assignment store with append-only metric observations.
* **Details:** Assignment cache (Redis) sits in front for sub-millisecond `assignVariant` hot path. Experiments and variants use PostgreSQL with strong consistency. Metric observations are append-only for analytical queries.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `ab_testing.<function>`. Assignment spans carry `experiment_id`, `variant_id`, and `subject_id` as attributes.
* **Telemetry Metrics:**
```
blueprint_ab_testing_operation_total               counter { function, result }
blueprint_ab_testing_operation_duration_ms         histogram { function }
blueprint_ab_testing_errors_total                  counter { function, error_code }
blueprint_ab_testing_assignments_total              counter { experiment_id, variant_id }
blueprint_ab_testing_exposures_total                counter { experiment_id, variant_id }
blueprint_ab_testing_metrics_recorded_total         counter { experiment_id, metric_name }
blueprint_ab_testing_assignment_cache_hit_ratio     gauge
blueprint_ab_testing_experiment_duration_ms         histogram { status }
```
* **SLO Targets:** `assignVariant` P99 ≤ 10ms (including cache); `recordMetric` P99 ≤ 100ms (async buffered).

### Module Dependencies
* **Depends On:** feature_flags, analytics, caching, audit_log
* **Emits To:** events
* **Recommends:** notifications (experiment lifecycle alerts), reporting (results dashboards), users (subject identity)

### Breaking Change Policy
- Adding new experiment status values or allocation strategies is additive and backward-compatible.
- Removing or renaming an existing status value requires a MAJOR version bump.
- Changing the `assignVariant` idempotency semantics (hash key composition) requires a MAJOR version bump.
- Adding new required fields to `CreateExperimentInput` requires a MAJOR version bump.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Assignment inconsistency | Cache miss falls back to different variant | Write-through cache with DB authoritativeness; reconcile on read |
| Metric lost during ingestion | Buffer overflow under high traffic | Sample or drop oldest; log dropped count |
| Experiment auto-stopped | max_duration reached | Graceful stop; emit event; preserve data for analysis |
| Statistical computation timeout | Large dataset with many variants | Stream computation; return partial results with warning |
| Cross-region hash mismatch | Different hash function implementations | Pin hash algorithm via allocation_strategy config |
