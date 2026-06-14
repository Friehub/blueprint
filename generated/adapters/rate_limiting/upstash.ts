// upstash.ts
// Auto-generated adapter for upstash → rate_limiting
// Do not edit manually

import type { RateLimitingContract } from '../interfaces/rate_limiting';

export class UpstashAdapter implements RateLimitingContract {
  constructor(private config: {
  url: string;
  token: string;
  }) {}

  checkLimit(key: unknown, limit: unknown, window: unknown): Promise<RateLimitResult> {
    // TODO: Implement with checkLimit
    throw new Error('Not implemented');
  }
  consumeToken(key: unknown, limit: unknown, window: unknown, cost?: unknown): Promise<RateLimitResult> {
    // TODO: Implement with consumeToken
    throw new Error('Not implemented');
  }
  resetLimit(key: unknown): Promise<void> {
    // TODO: Implement with resetLimit
    throw new Error('Not implemented');
  }
  getLimitStatus(key: unknown): Promise<LimitStatus> {
    // TODO: Implement with getLimitStatus
    throw new Error('Not implemented');
  }
  setCustomLimit(key: unknown, limit: unknown, window: unknown): Promise<void> {
    // TODO: Implement with setCustomLimit
    throw new Error('Not implemented');
  }
}
