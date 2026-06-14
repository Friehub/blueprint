// paypal.ts
// Auto-generated adapter for paypal → payouts
// Do not edit manually

import type { PayoutsContract } from '../interfaces/payouts';

export class PaypalAdapter implements PayoutsContract {
  constructor(private config: {
  client_id: string;
  client_secret: string;
  }) {}

  createPayout(sourceAccountId: unknown, recipientId: unknown, amount: unknown, currency: unknown, destination: unknown): Promise<Payout> {
    // TODO: Implement with createPayout
    throw new Error('Not implemented');
  }
  getPayout(payoutId: unknown): Promise<Payout> {
    // TODO: Implement with getPayout
    throw new Error('Not implemented');
  }
  listPayouts(input: unknown, options?: unknown): Promise<PaginatedResult<Payout>> {
    // TODO: Implement with listPayouts
    throw new Error('Not implemented');
  }
  cancelPayout(payoutId: unknown, reason: unknown): Promise<Payout> {
    // TODO: Implement with cancelPayout
    throw new Error('Not implemented');
  }
  retryPayout(payoutId: unknown): Promise<Payout> {
    // TODO: Implement with retryPayout
    throw new Error('Not implemented');
  }
  schedulePayout(sourceAccountId: unknown, destination: unknown, schedule: unknown): Promise<PayoutSchedule> {
    // TODO: Implement with schedulePayout
    throw new Error('Not implemented');
  }
  getPayoutSchedule(scheduleId: unknown): Promise<PayoutSchedule> {
    // TODO: Implement with getPayoutSchedule
    throw new Error('Not implemented');
  }
}
