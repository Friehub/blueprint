// vonage.test.ts
// Auto-generated conformance test for vonage → sms
// Do not edit manually

import { VonageAdapter } from '../adapters/sms/vonage';
import type { SmsContract } from '../interfaces/sms';

describe('VonageAdapter implements SmsContract', () => {
  const adapter: SmsContract = new VonageAdapter({
    api_key: 'test',
    api_secret: 'test',
    from_number: 'test'
  });

  it('has send method', () => {
    expect(typeof adapter.send).toBe('function');
  });

  it('has sendBulk method', () => {
    expect(typeof adapter.sendBulk).toBe('function');
  });

  it('has getDeliveryStatus method', () => {
    expect(typeof adapter.getDeliveryStatus).toBe('function');
  });

  it('has getBalance method', () => {
    expect(typeof adapter.getBalance).toBe('function');
  });

  it('has lookupNumber method', () => {
    expect(typeof adapter.lookupNumber).toBe('function');
  });

});
