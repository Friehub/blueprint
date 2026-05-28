// easyship.test.ts
// Auto-generated conformance test for easyship → shipping
// Do not edit manually

import { EasyshipAdapter } from '../adapters/shipping/easyship';
import type { ShippingContract } from '../interfaces/shipping';

describe('EasyshipAdapter implements ShippingContract', () => {
  const adapter: ShippingContract = new EasyshipAdapter({
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
