// sendgrid.test.ts
// Auto-generated conformance test for sendgrid → emails
// Do not edit manually

import { SendgridAdapter } from '../adapters/emails/sendgrid';
import type { EmailsContract } from '../interfaces/emails';

describe('SendgridAdapter implements EmailsContract', () => {
  const adapter: EmailsContract = new SendgridAdapter({
    api_key: 'test',
    from_email: 'test'
  });

  it('has sendTransactional method', () => {
    expect(typeof adapter.sendTransactional).toBe('function');
  });

  it('has sendBulk method', () => {
    expect(typeof adapter.sendBulk).toBe('function');
  });

  it('has createTemplate method', () => {
    expect(typeof adapter.createTemplate).toBe('function');
  });

  it('has updateTemplate method', () => {
    expect(typeof adapter.updateTemplate).toBe('function');
  });

  it('has getTemplate method', () => {
    expect(typeof adapter.getTemplate).toBe('function');
  });

  it('has listTemplates method', () => {
    expect(typeof adapter.listTemplates).toBe('function');
  });

  it('has getDeliveryStatus method', () => {
    expect(typeof adapter.getDeliveryStatus).toBe('function');
  });

  it('has getDeliveryEvents method', () => {
    expect(typeof adapter.getDeliveryEvents).toBe('function');
  });

});
