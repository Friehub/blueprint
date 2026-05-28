// paddle.test.ts
// Auto-generated conformance test for paddle → billing
// Do not edit manually

import { PaddleAdapter } from '../adapters/billing/paddle';
import type { BillingContract } from '../interfaces/billing';

describe('PaddleAdapter implements BillingContract', () => {
  const adapter: BillingContract = new PaddleAdapter({
    vendor_id: 'test',
    api_key: 'test',
    client_side_token: 'test',
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
