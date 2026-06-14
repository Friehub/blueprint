// usage_metering.ts
// Auto-generated from contracts/usage_metering.md
// Do not edit manually

export interface Usagerecord {
  id: string;
  userId: string;
  metric: unknown;
  quantity: unknown;
  timestamp: unknown;
}

export interface Usagesummary {
  metric: unknown;
  total: unknown;
  limit: unknown;
  periodStart: unknown;
  periodEnd: unknown;
}

export interface Quotacheck {
  allowed: unknown;
  used: unknown;
  limit: unknown;
  remaining: unknown;
}

export interface Overage {
  amount: unknown;
  metric: unknown;
  period: unknown;
}

export interface UsageMeteringContract {
  recordUsage(userId: unknown, metric: unknown, quantity: unknown, timestamp?: unknown): Promise<UsageRecord>;
  getUsageSummary(userId: unknown, metric: unknown, period: unknown): Promise<UsageSummary>;
  checkQuota(userId: unknown, metric: unknown): Promise<QuotaCheck>;
  getOverage(userId: unknown, metric: unknown, period: unknown): Promise<Overage | undefined>;
  setQuota(userId: unknown, metric: unknown, limit: unknown): Promise<void>;
  resetUsage(userId: unknown, metric: unknown): Promise<void>;
  getUsageHistory(userId: unknown, metric: unknown, options?: unknown): Promise<PaginatedResult<UsageRecord>>;
}
