// svix.ts
// Auto-generated adapter for svix → webhooks
// Do not edit manually

import type { WebhooksContract } from '../interfaces/webhooks';

export class SvixAdapter implements WebhooksContract {
  constructor(private config: {
  api_key: string;
  application_id: string;
  }) {}

  registerEndpoint(url: unknown, events: unknown, secret: unknown, metadata?: unknown): Promise<WebhookEndpoint> {
    // TODO: Implement with registerEndpoint
    throw new Error('Not implemented');
  }
  updateEndpoint(endpointId: unknown, data: unknown): Promise<WebhookEndpoint> {
    // TODO: Implement with updateEndpoint
    throw new Error('Not implemented');
  }
  removeEndpoint(endpointId: unknown): Promise<void> {
    // TODO: Implement with removeEndpoint
    throw new Error('Not implemented');
  }
  listEndpoints(ownerId: unknown): Promise<WebhookEndpoint[]> {
    // TODO: Implement with listEndpoints
    throw new Error('Not implemented');
  }
  dispatchEvent(eventType: unknown, payload: unknown, ownerId: unknown): Promise<void> {
    // TODO: Implement with dispatchEvent
    throw new Error('Not implemented');
  }
  retryDelivery(deliveryId: unknown): Promise<WebhookDelivery> {
    // TODO: Implement with retryDelivery
    throw new Error('Not implemented');
  }
  getDeliveries(endpointId: unknown, options?: unknown): Promise<PaginatedResult<WebhookDelivery>> {
    // TODO: Implement with getDeliveries
    throw new Error('Not implemented');
  }
  getDelivery(deliveryId: unknown): Promise<WebhookDelivery> {
    // TODO: Implement with getDelivery
    throw new Error('Not implemented');
  }
}
