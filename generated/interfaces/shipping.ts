// shipping.ts
// Auto-generated from contracts/shipping.md
// Do not edit manually

export interface Shippingrate {
  carrier: unknown;
  service: unknown;
  price: unknown;
  currency: unknown;
  estimatedDays: unknown;
}

export interface Shipment {
  id: string;
  orderId: string;
  carrier: unknown;
  trackingNumber: unknown;
  status: unknown;
}

export interface Trackingresult {
  status: unknown;
  events: TrackingEvent[];
}

export interface Trackingevent {
  status: unknown;
  location: unknown;
  timestamp: unknown;
  description: unknown;
}

export interface Shippinglabel {
  url: unknown;
  format: pdf|png;
  expiresAt: Timestamp;
}

export interface Addressvalidation {
  valid: unknown;
}

export interface ShippingContract {
  getRates(origin: unknown, destination: unknown, parcels: unknown): Promise<ShippingRate[]>;
  createShipment(orderId: unknown, rateId: unknown, parcels: unknown): Promise<Shipment>;
  getShipment(shipmentId: unknown): Promise<Shipment>;
  trackShipment(trackingNumber: unknown, carrier?: unknown): Promise<TrackingResult>;
  cancelShipment(shipmentId: unknown): Promise<void>;
  createLabel(shipmentId: unknown): Promise<ShippingLabel>;
  getLabel(shipmentId: unknown): Promise<ShippingLabel>;
  validateAddress(address: unknown): Promise<AddressValidation>;
}
