// reconciliation.ts
// Auto-generated from contracts/reconciliation.md
// Do not edit manually

export interface Reconciliationrun {
  id: string;
  name: unknown;
  status: unknown;
  sourceType: string;
  targetType: string;
  periodStart: unknown;
  periodEnd: unknown;
  matchedCount: number;
  unmatchedCount: number;
  createdAt: Timestamp;
}

export interface Discrepancy {
  id: string;
  runId: string;
  recordKey: string;
  diff: unknown;
  status: unknown;
  createdAt: Timestamp;
}

export type Reconciliationstatus = ReconciliationStatus = pending | running | matched | partially_matched | failed | closed;

export type Resolution = Resolution = accept_source | accept_target | manual_adjustment | ignore;

export interface ReconciliationContract {
  createReconciliationRun(input: unknown): Promise<ReconciliationRun>;
  getReconciliationRun(runId: unknown): Promise<ReconciliationRun>;
  listReconciliationRuns(input: unknown): Promise<PaginatedResult<ReconciliationRun>>;
  getDiscrepancies(runId: unknown, options?: unknown): Promise<PaginatedResult<Discrepancy>>;
  resolveDiscrepancy(discrepancyId: unknown, resolution: unknown): Promise<Discrepancy>;
  retryRun(runId: unknown): Promise<ReconciliationRun>;
  closeRun(runId: unknown): Promise<ReconciliationRun>;
}
