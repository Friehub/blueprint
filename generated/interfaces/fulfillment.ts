// fulfillment.ts
// Auto-generated from contracts/fulfillment.md
// Do not edit manually

export interface Fulfillment {
  id: string;
  orderId: string;
  status: unknown;
  createdAt: Timestamp;
}

export type Fulfillmentstatus = FulfillmentStatus = pending | allocated | packed | shipped | delivered | cancelled | exception;

export interface FulfillmentContract {
  createFulfillment(orderId: unknown, warehouseId?: unknown): Promise<Fulfillment>;
  getFulfillment(fulfillmentId: unknown): Promise<Fulfillment>;
  listFulfillments(input: unknown, options?: unknown): Promise<PaginatedResult<Fulfillment>>;
  assignWarehouse(fulfillmentId: unknown, warehouseId: unknown): Promise<Fulfillment>;
  markPacked(fulfillmentId: unknown, metadata?: unknown): Promise<Fulfillment>;
  markShipped(fulfillmentId: unknown, trackingNumber: unknown, carrier?: unknown): Promise<Fulfillment>;
  markDelivered(fulfillmentId: unknown, deliveredAt?: unknown): Promise<Fulfillment>;
  cancelFulfillment(fulfillmentId: unknown, reason: unknown): Promise<Fulfillment>;
}
