// webhooks.ts
// Auto-generated from contracts/webhooks.md
// Do not edit manually

export interface Webhookendpoint {
  id: string;
  url: unknown;
  events: unknown;
  status: unknown;
  createdAt: Timestamp;
}

export interface Webhookdelivery {
  id: string;
  endpointId: string;
  eventType: string;
  payload: unknown;
  status: unknown;
  attempts: unknown;
}

export type Webhookstatus = WebhookStatus = active | disabled | failing;

export type Deliverystatus = DeliveryStatus = pending | success | failed;

export interface WebhooksContract {
  registerEndpoint(url: unknown, events: unknown, secret: unknown, metadata?: unknown): Promise<WebhookEndpoint>;
  updateEndpoint(endpointId: unknown, data: unknown): Promise<WebhookEndpoint>;
  removeEndpoint(endpointId: unknown): Promise<void>;
  listEndpoints(ownerId: unknown): Promise<WebhookEndpoint[]>;
  dispatchEvent(eventType: unknown, payload: unknown, ownerId: unknown): Promise<void>;
  retryDelivery(deliveryId: unknown): Promise<WebhookDelivery>;
  getDeliveries(endpointId: unknown, options?: unknown): Promise<PaginatedResult<WebhookDelivery>>;
  getDelivery(deliveryId: unknown): Promise<WebhookDelivery>;
}
