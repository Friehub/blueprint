// chargebee.test.ts
// Auto-generated conformance test for chargebee → subscriptions
// Do not edit manually

import { ChargebeeAdapter } from '../adapters/subscriptions/chargebee';
import type { SubscriptionsContract } from '../interfaces/subscriptions';

describe('ChargebeeAdapter implements SubscriptionsContract', () => {
  const adapter: SubscriptionsContract = new ChargebeeAdapter({
    api_key: 'test',
    site: 'test'
  });

  it('has getEntitlements method', () => {
    expect(typeof adapter.getEntitlements).toBe('function');
  });

  it('has hasAccess method', () => {
    expect(typeof adapter.hasAccess).toBe('function');
  });

  it('has grantEntitlement method', () => {
    expect(typeof adapter.grantEntitlement).toBe('function');
  });

  it('has revokeEntitlement method', () => {
    expect(typeof adapter.revokeEntitlement).toBe('function');
  });

  it('has getAccessHistory method', () => {
    expect(typeof adapter.getAccessHistory).toBe('function');
  });

});
