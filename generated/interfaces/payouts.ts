// payouts.ts
// Auto-generated from contracts/payouts.md
// Do not edit manually

export interface Payout {
  id: string;
  sourceAccountId: string;
  recipientId: string;
  amount: unknown;
  currency: unknown;
  destination: unknown;
  status: unknown;
  createdAt: Timestamp;
}

export interface Payoutschedule {
  id: string;
  sourceAccountId: string;
  destination: unknown;
  cadence: unknown;
  status: unknown;
  createdAt: Timestamp;
}

export type Payoutstatus = PayoutStatus = pending | queued | processing | paid | failed | cancelled | reversed;

export interface PayoutsContract {
  createPayout(sourceAccountId: unknown, recipientId: unknown, amount: unknown, currency: unknown, destination: unknown): Promise<Payout>;
  getPayout(payoutId: unknown): Promise<Payout>;
  listPayouts(input: unknown, options?: unknown): Promise<PaginatedResult<Payout>>;
  cancelPayout(payoutId: unknown, reason: unknown): Promise<Payout>;
  retryPayout(payoutId: unknown): Promise<Payout>;
  schedulePayout(sourceAccountId: unknown, destination: unknown, schedule: unknown): Promise<PayoutSchedule>;
  getPayoutSchedule(scheduleId: unknown): Promise<PayoutSchedule>;
}
