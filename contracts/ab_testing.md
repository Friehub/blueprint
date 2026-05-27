# Module: ab_testing

**Version:** 0.1.0
**Part:** III — Data and State

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
Assigns a subject to a variant deterministically based on the experiment's allocation strategy. If the subject is already assigned, returns the existing assignment. This is the hot-path operation — it must be sub-millisecond.

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
  trafficPercent: number;          // Percent of eligible subjects enrolled (0–100)
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
- `experiment.concluded` — includes `winningVariantId`
- `experiment.variant.assigned` — includes `subjectId`, `variantId`
- `experiment.variant.exposed`

---

## System-Level Integrations

- **Idempotency:** `assignVariant` and `recordExposure` are idempotent on `(experimentId, subjectId)`.
- **Consistency:** Assignments must be written to durable storage before `assignVariant` returns; in-memory-only assignment breaks the idempotency guarantee across process restarts.
- **Observability:** All assignment and exposure events must carry the experiment ID and variant ID as trace attributes so downstream analytics can join on experiment participation.
- **Dependencies:** `feature_flags` (experiments can gate on flags for eligibility), `analytics` (metric observation pipeline), `caching` (assignment cache for hot-path latency), `audit_log` (experiment lifecycle changes).
- **Errors:** `EXPERIMENT_NOT_FOUND`, `EXPERIMENT_NOT_RUNNING`, `INVALID_ALLOCATION`, `SUBJECT_NOT_ASSIGNED`, `METRIC_NOT_DEFINED`, `VARIANT_NOT_FOUND`, `EXPERIMENT_NOT_STOPPABLE`.
- **Providers (adapter examples):** Custom Bayesian/frequentist implementation, LaunchDarkly experiments, Optimizely, GrowthBook, Statsig.
