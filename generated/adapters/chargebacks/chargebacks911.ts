// chargebacks911.ts
// Auto-generated adapter for chargebacks911 → chargebacks
// Do not edit manually

import type { ChargebacksContract } from '../interfaces/chargebacks';

export class Chargebacks911Adapter implements ChargebacksContract {
  constructor(private config: {
  api_key: string;
  merchant_id: string;
  }) {}

  createChargeback(paymentId: unknown, reason: unknown, metadata?: unknown): Promise<Chargeback> {
    // TODO: Implement with createChargeback
    throw new Error('Not implemented');
  }
  getChargeback(chargebackId: unknown): Promise<Chargeback> {
    // TODO: Implement with getChargeback
    throw new Error('Not implemented');
  }
  listChargebacks(input: unknown, options?: unknown): Promise<PaginatedResult<Chargeback>> {
    // TODO: Implement with listChargebacks
    throw new Error('Not implemented');
  }
  submitEvidence(chargebackId: unknown, evidence: unknown): Promise<Chargeback> {
    // TODO: Implement with submitEvidence
    throw new Error('Not implemented');
  }
  updateChargebackStatus(chargebackId: unknown, status: unknown, metadata?: unknown): Promise<Chargeback> {
    // TODO: Implement with updateChargebackStatus
    throw new Error('Not implemented');
  }
  closeChargeback(chargebackId: unknown): Promise<Chargeback> {
    // TODO: Implement with closeChargeback
    throw new Error('Not implemented');
  }
}
