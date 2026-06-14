// stripe.test.ts
// Auto-generated conformance test for stripe → payouts
// Do not edit manually

import { StripeAdapter } from '../adapters/payouts/stripe';
import type { PayoutsContract } from '../interfaces/payouts';

describe('StripeAdapter implements PayoutsContract', () => {
  const adapter: PayoutsContract = new StripeAdapter({
    api_key: 'test',
    webhook_secret: 'test'
  });

  it('has createPayout method', () => {
    expect(typeof adapter.createPayout).toBe('function');
  });

  it('has getPayout method', () => {
    expect(typeof adapter.getPayout).toBe('function');
  });

  it('has listPayouts method', () => {
    expect(typeof adapter.listPayouts).toBe('function');
  });

  it('has cancelPayout method', () => {
    expect(typeof adapter.cancelPayout).toBe('function');
  });

  it('has retryPayout method', () => {
    expect(typeof adapter.retryPayout).toBe('function');
  });

  it('has schedulePayout method', () => {
    expect(typeof adapter.schedulePayout).toBe('function');
  });

  it('has getPayoutSchedule method', () => {
    expect(typeof adapter.getPayoutSchedule).toBe('function');
  });

});
