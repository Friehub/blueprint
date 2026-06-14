// sendgrid.ts
// Auto-generated adapter for sendgrid → emails
// Do not edit manually

import type { EmailsContract } from '../interfaces/emails';

export class SendgridAdapter implements EmailsContract {
  constructor(private config: {
  api_key: string;
  from_email: string;
  }) {}

  sendTransactional(to: unknown, templateId: unknown, variables: unknown, options?: unknown): Promise<DeliveryResult> {
    // TODO: Implement with sendTransactional
    throw new Error('Not implemented');
  }
  sendBulk(recipients: unknown, templateId: unknown, variables: unknown): Promise<BulkDeliveryResult> {
    // TODO: Implement with sendBulk
    throw new Error('Not implemented');
  }
  createTemplate(name: unknown, subject: unknown, html: unknown, text?: unknown): Promise<EmailTemplate> {
    // TODO: Implement with createTemplate
    throw new Error('Not implemented');
  }
  updateTemplate(templateId: unknown, data: unknown): Promise<EmailTemplate> {
    // TODO: Implement with updateTemplate
    throw new Error('Not implemented');
  }
  getTemplate(templateId: unknown): Promise<EmailTemplate> {
    // TODO: Implement with getTemplate
    throw new Error('Not implemented');
  }
  listTemplates(): Promise<EmailTemplate[]> {
    // TODO: Implement with listTemplates
    throw new Error('Not implemented');
  }
  getDeliveryStatus(messageId: unknown): Promise<DeliveryStatus> {
    // TODO: Implement with getDeliveryStatus
    throw new Error('Not implemented');
  }
  getDeliveryEvents(messageId: unknown): Promise<DeliveryEvent[]> {
    // TODO: Implement with getDeliveryEvents
    throw new Error('Not implemented');
  }
}
