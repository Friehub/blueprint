// ab_testing.ts
// Auto-generated from contracts/ab_testing.md
// Do not edit manually

export type ExperimentId = string;

export type VariantId = string;

export type ExperimentStatus = "DRAFT" | "RUNNING" | "PAUSED" | "STOPPED" | "CONCLUDED" | "ARCHIVED";

export type AllocationStrategy = "RANDOM" | "DETERMINISTIC_HASH" | "STICKY_SESSION";

export type Variant = {
variantId: VariantId;
name: string;                    // e.g. "control", "treatment_a"
description?: string;
allocationPercent: number;       // Must sum to 100 across all variants
isControl: boolean;
};

export type TargetMetric = {
name: string;                    // e.g. "checkout_conversion", "revenue_per_user"
type: "BINARY" | "CONTINUOUS";  // BINARY = converted/not; CONTINUOUS = revenue amount
isPrimary: boolean;              // Only one primary metric per experiment
};

export type CreateExperimentInput = {
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

export type Experiment = CreateExperimentInput & {

export type VariantAssignment = {
experimentId: ExperimentId;
subjectId: string;
variantId: VariantId;
variantName: string;
assignedAt: Timestamp;
exposed: boolean;
};

export type AssignVariantInput = {
experimentId: ExperimentId;
subjectId: string;
subjectAttributes?: Record<string, unknown>;
};

export type RecordExposureInput = {
experimentId: ExperimentId;
subjectId: string;
exposedAt?: Timestamp;
};

export type RecordMetricInput = {
experimentId: ExperimentId;
subjectId: string;
metricName: string;
value: number;                   // 1/0 for BINARY; numeric for CONTINUOUS
recordedAt?: Timestamp;
};

export type VariantResult = {
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

export type ExperimentResults = {
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

export type ConcludeExperimentInput = {
experimentId: ExperimentId;
winningVariantId: VariantId;
conclusionNotes?: string;
};

export type ListExperimentsInput = {
status?: ExperimentStatus;
primaryMetric?: string;
pagination: PaginationInput;
};

export interface AbTestingContract {
  createExperiment(input: CreateExperimentInput): Promise<Experiment>;
  startExperiment(experimentId: ExperimentId): Promise<Experiment>;
  pauseExperiment(experimentId: ExperimentId): Promise<Experiment>;
  resumeExperiment(experimentId: ExperimentId): Promise<Experiment>;
  stopExperiment(experimentId: ExperimentId): Promise<Experiment>;
  concludeExperiment(input: ConcludeExperimentInput): Promise<Experiment>;
  getExperiment(experimentId: ExperimentId): Promise<Experiment>;
  listExperiments(input: ListExperimentsInput): Promise<PaginatedList<Experiment>>;
  assignVariant(input: AssignVariantInput): Promise<VariantAssignment>;
  getAssignment(experimentId: ExperimentId, subjectId: string): Promise<VariantAssignment>;
  recordExposure(input: RecordExposureInput): Promise<void>;
  recordMetric(input: RecordMetricInput): Promise<void>;
  getResults(experimentId: ExperimentId): Promise<ExperimentResults>;
}
