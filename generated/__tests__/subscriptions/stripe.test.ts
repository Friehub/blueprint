// stripe.test.ts
// Auto-generated conformance test for stripe → subscriptions
// Do not edit manually

import { StripeAdapter } from '../adapters/subscriptions/stripe';
import type { SubscriptionsContract } from '../interfaces/subscriptions';

describe('StripeAdapter implements SubscriptionsContract', () => {
  const adapter: SubscriptionsContract = new StripeAdapter({
    api_key: 'test',
    webhook_secret: 'test'
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
