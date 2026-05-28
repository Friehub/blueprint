// ab_testing.ts
// Auto-generated from contracts/ab_testing.md
// Do not edit manually

export type ExperimentId = string;

export type VariantId = string;

export type ExperimentStatus = "DRAFT" | "RUNNING" | "PAUSED" | "STOPPED" | "CONCLUDED" | "ARCHIVED";

export type AllocationStrategy = "RANDOM" | "DETERMINISTIC_HASH" | "STICKY_SESSION";

export type Variant = {

export type TargetMetric = {

export type CreateExperimentInput = {

export type Experiment = CreateExperimentInput & {

export type VariantAssignment = {

export type AssignVariantInput = {

export type RecordExposureInput = {

export type RecordMetricInput = {

export type VariantResult = {

export type ExperimentResults = {

export type ConcludeExperimentInput = {

export type ListExperimentsInput = {

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
