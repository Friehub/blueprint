// chargebacks.ts
// Auto-generated from contracts/chargebacks.md
// Do not edit manually

export interface Chargeback {
  id: string;
  paymentId: string;
  reason: unknown;
  status: unknown;
  amount: unknown;
  currency: unknown;
  openedAt: Timestamp;
}

export interface Evidence {
  type: unknown;
  submittedAt: Timestamp;
}

export type Chargebackstatus = ChargebackStatus = open | evidence_due | submitted | won | lost | reversed | closed;

export interface ChargebacksContract {
  createChargeback(paymentId: unknown, reason: unknown, metadata?: unknown): Promise<Chargeback>;
  getChargeback(chargebackId: unknown): Promise<Chargeback>;
  listChargebacks(input: unknown, options?: unknown): Promise<PaginatedResult<Chargeback>>;
  submitEvidence(chargebackId: unknown, evidence: unknown): Promise<Chargeback>;
  updateChargebackStatus(chargebackId: unknown, status: unknown, metadata?: unknown): Promise<Chargeback>;
  closeChargeback(chargebackId: unknown): Promise<Chargeback>;
}
