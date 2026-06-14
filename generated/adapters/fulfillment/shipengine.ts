// shipengine.ts
// Auto-generated adapter for shipengine → fulfillment
// Do not edit manually

import type { FulfillmentContract } from '../interfaces/fulfillment';

export class ShipengineAdapter implements FulfillmentContract {
  constructor(private config: {
  api_key: string;
  }) {}

  createFulfillment(orderId: unknown, warehouseId?: unknown): Promise<Fulfillment> {
    // TODO: Implement with createFulfillment
    throw new Error('Not implemented');
  }
  getFulfillment(fulfillmentId: unknown): Promise<Fulfillment> {
    // TODO: Implement with getFulfillment
    throw new Error('Not implemented');
  }
  listFulfillments(input: unknown, options?: unknown): Promise<PaginatedResult<Fulfillment>> {
    // TODO: Implement with listFulfillments
    throw new Error('Not implemented');
  }
  assignWarehouse(fulfillmentId: unknown, warehouseId: unknown): Promise<Fulfillment> {
    // TODO: Implement with assignWarehouse
    throw new Error('Not implemented');
  }
  markPacked(fulfillmentId: unknown, metadata?: unknown): Promise<Fulfillment> {
    // TODO: Implement with markPacked
    throw new Error('Not implemented');
  }
  markShipped(fulfillmentId: unknown, trackingNumber: unknown, carrier?: unknown): Promise<Fulfillment> {
    // TODO: Implement with markShipped
    throw new Error('Not implemented');
  }
  markDelivered(fulfillmentId: unknown, deliveredAt?: unknown): Promise<Fulfillment> {
    // TODO: Implement with markDelivered
    throw new Error('Not implemented');
  }
  cancelFulfillment(fulfillmentId: unknown, reason: unknown): Promise<Fulfillment> {
    // TODO: Implement with cancelFulfillment
    throw new Error('Not implemented');
  }
}
