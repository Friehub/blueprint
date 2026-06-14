// upstash.test.ts
// Auto-generated conformance test for upstash → rate_limiting
// Do not edit manually

import { UpstashAdapter } from '../adapters/rate_limiting/upstash';
import type { RateLimitingContract } from '../interfaces/rate_limiting';

describe('UpstashAdapter implements RateLimitingContract', () => {
  const adapter: RateLimitingContract = new UpstashAdapter({
    url: 'test',
    token: 'test'
  });

  it('has checkLimit method', () => {
    expect(typeof adapter.checkLimit).toBe('function');
  });

  it('has consumeToken method', () => {
    expect(typeof adapter.consumeToken).toBe('function');
  });

  it('has resetLimit method', () => {
    expect(typeof adapter.resetLimit).toBe('function');
  });

  it('has getLimitStatus method', () => {
    expect(typeof adapter.getLimitStatus).toBe('function');
  });

  it('has setCustomLimit method', () => {
    expect(typeof adapter.setCustomLimit).toBe('function');
  });

});
