// cloudflare.test.ts
// Auto-generated conformance test for cloudflare → rate_limiting
// Do not edit manually

import { CloudflareAdapter } from '../adapters/rate_limiting/cloudflare';
import type { RateLimitingContract } from '../interfaces/rate_limiting';

describe('CloudflareAdapter implements RateLimitingContract', () => {
  const adapter: RateLimitingContract = new CloudflareAdapter({
    api_token: 'test',
    zone_id: 'test'
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
