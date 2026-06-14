// easyship.test.ts
// Auto-generated conformance test for easyship → fulfillment
// Do not edit manually

import { EasyshipAdapter } from '../adapters/fulfillment/easyship';
import type { FulfillmentContract } from '../interfaces/fulfillment';

describe('EasyshipAdapter implements FulfillmentContract', () => {
  const adapter: FulfillmentContract = new EasyshipAdapter({
    api_key: 'test'
  });

  it('has createFulfillment method', () => {
    expect(typeof adapter.createFulfillment).toBe('function');
  });

  it('has getFulfillment method', () => {
    expect(typeof adapter.getFulfillment).toBe('function');
  });

  it('has listFulfillments method', () => {
    expect(typeof adapter.listFulfillments).toBe('function');
  });

  it('has assignWarehouse method', () => {
    expect(typeof adapter.assignWarehouse).toBe('function');
  });

  it('has markPacked method', () => {
    expect(typeof adapter.markPacked).toBe('function');
  });

  it('has markShipped method', () => {
    expect(typeof adapter.markShipped).toBe('function');
  });

  it('has markDelivered method', () => {
    expect(typeof adapter.markDelivered).toBe('function');
  });

  it('has cancelFulfillment method', () => {
    expect(typeof adapter.cancelFulfillment).toBe('function');
  });

});
