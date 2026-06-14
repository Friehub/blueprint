// bank_reconciliation.ts
// Auto-generated from contracts/bank_reconciliation.md
// Do not edit manually

export interface Bankreconciliationrun {
  id: string;
  accountId: string;
  statementPeriod: unknown;
  status: unknown;
  matchedCount: number;
  unmatchedCount: number;
  createdAt: Timestamp;
}

export interface Statementmatch {
  id: string;
  runId: string;
  statementLineRef: unknown;
  amount: unknown;
  currency: unknown;
  status: unknown;
  createdAt: Timestamp;
}

export type Bankreconciliationstatus = BankReconciliationStatus = pending | running | matched | partially_matched | failed | closed;

export interface BankReconciliationContract {
  createBankReconciliationRun(input: unknown): Promise<BankReconciliationRun>;
  getBankReconciliationRun(runId: unknown): Promise<BankReconciliationRun>;
  listBankReconciliationRuns(input: unknown, options?: unknown): Promise<PaginatedResult<BankReconciliationRun>>;
  getStatementMatches(runId: unknown, options?: unknown): Promise<PaginatedResult<StatementMatch>>;
  resolveStatementMatch(matchId: unknown, resolution: unknown): Promise<StatementMatch>;
  closeBankReconciliationRun(runId: unknown): Promise<BankReconciliationRun>;
}
