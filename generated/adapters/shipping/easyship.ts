// easyship.ts
// Auto-generated adapter for easyship → shipping
// Do not edit manually

import type { ShippingContract } from '../interfaces/shipping';

export class EasyshipAdapter implements ShippingContract {
  constructor(private config: {
  api_key: string;
  }) {}

  getRates(origin: unknown, destination: unknown, parcels: unknown): Promise<ShippingRate[]> {
    // TODO: Implement with getRates
    throw new Error('Not implemented');
  }
  createShipment(orderId: unknown, rateId: unknown, parcels: unknown): Promise<Shipment> {
    // TODO: Implement with createShipment
    throw new Error('Not implemented');
  }
  getShipment(shipmentId: unknown): Promise<Shipment> {
    // TODO: Implement with getShipment
    throw new Error('Not implemented');
  }
  trackShipment(trackingNumber: unknown, carrier?: unknown): Promise<TrackingResult> {
    // TODO: Implement with trackShipment
    throw new Error('Not implemented');
  }
  cancelShipment(shipmentId: unknown): Promise<void> {
    // TODO: Implement with cancelShipment
    throw new Error('Not implemented');
  }
  createLabel(shipmentId: unknown): Promise<ShippingLabel> {
    // TODO: Implement with createLabel
    throw new Error('Not implemented');
  }
  getLabel(shipmentId: unknown): Promise<ShippingLabel> {
    // TODO: Implement with getLabel
    throw new Error('Not implemented');
  }
  validateAddress(address: unknown): Promise<AddressValidation> {
    // TODO: Implement with validateAddress
    throw new Error('Not implemented');
  }
}
