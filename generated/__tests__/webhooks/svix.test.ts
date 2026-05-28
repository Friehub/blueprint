// svix.test.ts
// Auto-generated conformance test for svix → webhooks
// Do not edit manually

import { SvixAdapter } from '../adapters/webhooks/svix';
import type { WebhooksContract } from '../interfaces/webhooks';

describe('SvixAdapter implements WebhooksContract', () => {
  const adapter: WebhooksContract = new SvixAdapter({
    api_key: 'test',
    application_id: 'test'
  });

  it('has registerEndpoint method', () => {
    expect(typeof adapter.registerEndpoint).toBe('function');
  });

  it('has updateEndpoint method', () => {
    expect(typeof adapter.updateEndpoint).toBe('function');
  });

  it('has removeEndpoint method', () => {
    expect(typeof adapter.removeEndpoint).toBe('function');
  });

  it('has listEndpoints method', () => {
    expect(typeof adapter.listEndpoints).toBe('function');
  });

  it('has dispatchEvent method', () => {
    expect(typeof adapter.dispatchEvent).toBe('function');
  });

  it('has retryDelivery method', () => {
    expect(typeof adapter.retryDelivery).toBe('function');
  });

  it('has getDeliveries method', () => {
    expect(typeof adapter.getDeliveries).toBe('function');
  });

  it('has getDelivery method', () => {
    expect(typeof adapter.getDelivery).toBe('function');
  });

});
