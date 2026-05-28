// rate_limiting.ts
// Auto-generated from contracts/rate_limiting.md
// Do not edit manually

export interface Ratelimitresult {
  allowed: unknown;
  remaining: unknown;
  resetAt: Timestamp;
}

export interface Limitstatus {
  current: unknown;
  limit: unknown;
  window: unknown;
  resetAt: Timestamp;
}

export type Limitwindow = LimitWindow = second | minute | hour | day;

export interface RateLimitingContract {
  checkLimit(key: unknown, limit: unknown, window: unknown): Promise<RateLimitResult>;
  consumeToken(key: unknown, limit: unknown, window: unknown, cost?: unknown): Promise<RateLimitResult>;
  resetLimit(key: unknown): Promise<void>;
  getLimitStatus(key: unknown): Promise<LimitStatus>;
  setCustomLimit(key: unknown, limit: unknown, window: unknown): Promise<void>;
}
