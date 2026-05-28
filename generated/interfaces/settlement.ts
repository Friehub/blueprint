// settlement.ts
// Auto-generated from contracts/settlement.md
// Do not edit manually

export interface Settlementbatch {
  id: string;
  source: unknown;
  period: unknown;
  status: unknown;
  grossAmount: number;
  netAmount: number;
  itemCount: number;
  createdAt: Timestamp;
}

export interface Settlementitem {
  id: string;
  batchId: string;
  reference: unknown;
  amount: unknown;
  currency: unknown;
  status: unknown;
}

export type Settlementstatus = SettlementStatus = open | closing | closed | settled | failed | disputed;

export interface SettlementContract {
  createSettlementBatch(source: unknown, period: unknown): Promise<SettlementBatch>;
  getSettlementBatch(batchId: unknown): Promise<SettlementBatch>;
  listSettlementBatches(input: unknown, options?: unknown): Promise<PaginatedResult<SettlementBatch>>;
  addSettlementItem(batchId: unknown, item: unknown): Promise<SettlementItem>;
  closeSettlementBatch(batchId: unknown): Promise<SettlementBatch>;
  confirmSettlement(batchId: unknown, reference: unknown, settledAt?: unknown): Promise<SettlementBatch>;
  failSettlement(batchId: unknown, reason: unknown): Promise<SettlementBatch>;
  reconcileBatch(batchId: unknown): Promise<SettlementBatch>;
}
