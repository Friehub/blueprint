// emails.ts
// Auto-generated from contracts/emails.md
// Do not edit manually

export interface Emailtemplate {
  id: string;
  name: unknown;
  subject: unknown;
  html: unknown;
  variables: string[];
}

export interface Deliveryevent {
  type: sent|delivered|opened|clicked|bounced|complained;
  timestamp: unknown;
}

export interface EmailsContract {
  sendTransactional(to: unknown, templateId: unknown, variables: unknown, options?: unknown): Promise<DeliveryResult>;
  sendBulk(recipients: unknown, templateId: unknown, variables: unknown): Promise<BulkDeliveryResult>;
  createTemplate(name: unknown, subject: unknown, html: unknown, text?: unknown): Promise<EmailTemplate>;
  updateTemplate(templateId: unknown, data: unknown): Promise<EmailTemplate>;
  getTemplate(templateId: unknown): Promise<EmailTemplate>;
  listTemplates(): Promise<EmailTemplate[]>;
  getDeliveryStatus(messageId: unknown): Promise<DeliveryStatus>;
  getDeliveryEvents(messageId: unknown): Promise<DeliveryEvent[]>;
}
