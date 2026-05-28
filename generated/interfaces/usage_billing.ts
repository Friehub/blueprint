// usage_billing.ts
// Auto-generated from contracts/usage_billing.md
// Do not edit manually

export interface Usagerecord {
  id: string;
  accountId: string;
  metric: unknown;
  value: unknown;
  occurredAt: Timestamp;
}

export interface Usagesummary {
  accountId: string;
  metric: unknown;
  period: unknown;
  total: unknown;
  billedTotal: number;
  unit: unknown;
  finalized: unknown;
}

export interface Usagecharge {
  id: string;
  accountId: string;
  period: unknown;
  status: unknown;
  amount: unknown;
  currency: unknown;
  createdAt: Timestamp;
}

export type Usageperiod = UsagePeriod = open | closing | closed | reopened;

export interface UsageBillingContract {
  recordUsage(accountId: unknown, metric: unknown, value: unknown, occurredAt?: unknown, metadata?: unknown): Promise<UsageRecord>;
  getUsage(accountId: unknown, metric: unknown, options?: unknown): Promise<PaginatedResult<UsageRecord>>;
  aggregateUsage(accountId: unknown, period: unknown, metric?: unknown): Promise<UsageSummary>;
  createUsageCharge(accountId: unknown, period: unknown, metadata?: unknown): Promise<UsageCharge>;
  finalizeUsageCharge(chargeId: unknown): Promise<UsageCharge>;
  adjustUsageCharge(chargeId: unknown, adjustment: unknown): Promise<UsageCharge>;
  closeUsagePeriod(accountId: unknown, period: unknown): Promise<UsagePeriod>;
}
