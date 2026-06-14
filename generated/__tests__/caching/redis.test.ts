// redis.test.ts
// Auto-generated conformance test for redis → caching
// Do not edit manually

import { RedisAdapter } from '../adapters/caching/redis';
import type { CachingContract } from '../interfaces/caching';

describe('RedisAdapter implements CachingContract', () => {
  const adapter: CachingContract = new RedisAdapter({
    url: 'test'
  });

  it('has del method', () => {
    expect(typeof adapter.del).toBe('function');
  });

  it('has invalidateByTag method', () => {
    expect(typeof adapter.invalidateByTag).toBe('function');
  });

  it('has invalidateByPrefix method', () => {
    expect(typeof adapter.invalidateByPrefix).toBe('function');
  });

  it('has mset method', () => {
    expect(typeof adapter.mset).toBe('function');
  });

  it('has increment method', () => {
    expect(typeof adapter.increment).toBe('function');
  });

  it('has decrement method', () => {
    expect(typeof adapter.decrement).toBe('function');
  });

});
