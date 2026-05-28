// stripe.test.ts
// Auto-generated conformance test for stripe → billing
// Do not edit manually

import { StripeAdapter } from '../adapters/billing/stripe';
import type { BillingContract } from '../interfaces/billing';

describe('StripeAdapter implements BillingContract', () => {
  const adapter: BillingContract = new StripeAdapter({
    api_key: 'test',
    webhook_secret: 'test'
  });

  it('has createSubscription method', () => {
    expect(typeof adapter.createSubscription).toBe('function');
  });

  it('has getSubscription method', () => {
    expect(typeof adapter.getSubscription).toBe('function');
  });

  it('has upgradeSubscription method', () => {
    expect(typeof adapter.upgradeSubscription).toBe('function');
  });

  it('has downgradeSubscription method', () => {
    expect(typeof adapter.downgradeSubscription).toBe('function');
  });

  it('has cancelSubscription method', () => {
    expect(typeof adapter.cancelSubscription).toBe('function');
  });

  it('has reactivateSubscription method', () => {
    expect(typeof adapter.reactivateSubscription).toBe('function');
  });

  it('has getInvoices method', () => {
    expect(typeof adapter.getInvoices).toBe('function');
  });

  it('has getInvoice method', () => {
    expect(typeof adapter.getInvoice).toBe('function');
  });

  it('has getPlans method', () => {
    expect(typeof adapter.getPlans).toBe('function');
  });

  it('has getPlan method', () => {
    expect(typeof adapter.getPlan).toBe('function');
  });

});
