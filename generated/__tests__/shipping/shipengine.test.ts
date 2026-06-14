// shipengine.test.ts
// Auto-generated conformance test for shipengine → shipping
// Do not edit manually

import { ShipengineAdapter } from '../adapters/shipping/shipengine';
import type { ShippingContract } from '../interfaces/shipping';

describe('ShipengineAdapter implements ShippingContract', () => {
  const adapter: ShippingContract = new ShipengineAdapter({
    api_key: 'test'
  });

  it('has getRates method', () => {
    expect(typeof adapter.getRates).toBe('function');
  });

  it('has createShipment method', () => {
    expect(typeof adapter.createShipment).toBe('function');
  });

  it('has getShipment method', () => {
    expect(typeof adapter.getShipment).toBe('function');
  });

  it('has trackShipment method', () => {
    expect(typeof adapter.trackShipment).toBe('function');
  });

  it('has cancelShipment method', () => {
    expect(typeof adapter.cancelShipment).toBe('function');
  });

  it('has createLabel method', () => {
    expect(typeof adapter.createLabel).toBe('function');
  });

  it('has getLabel method', () => {
    expect(typeof adapter.getLabel).toBe('function');
  });

  it('has validateAddress method', () => {
    expect(typeof adapter.validateAddress).toBe('function');
  });

});
