// paypal.test.ts
// Auto-generated conformance test for paypal → payouts
// Do not edit manually

import { PaypalAdapter } from '../adapters/payouts/paypal';
import type { PayoutsContract } from '../interfaces/payouts';

describe('PaypalAdapter implements PayoutsContract', () => {
  const adapter: PayoutsContract = new PaypalAdapter({
    client_id: 'test',
    client_secret: 'test'
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
