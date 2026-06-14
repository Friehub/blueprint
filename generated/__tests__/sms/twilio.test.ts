// twilio.test.ts
// Auto-generated conformance test for twilio → sms
// Do not edit manually

import { TwilioAdapter } from '../adapters/sms/twilio';
import type { SmsContract } from '../interfaces/sms';

describe('TwilioAdapter implements SmsContract', () => {
  const adapter: SmsContract = new TwilioAdapter({
    account_sid: 'test',
    auth_token: 'test',
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
