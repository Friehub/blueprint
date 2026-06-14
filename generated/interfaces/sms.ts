// sms.ts
// Auto-generated from contracts/sms.md
// Do not edit manually

export interface Smsbalance {
  amount: unknown;
  currency: unknown;
  units: unknown;
}

export interface Numberlookup {
  valid: unknown;
  countryCode: unknown;
  lineType: mobile | landline | voip;
}

export interface SmsContract {
  send(to: unknown, body: unknown, senderId?: unknown, options?: unknown): Promise<DeliveryResult>;
  sendBulk(recipients: unknown, body: unknown): Promise<BulkDeliveryResult>;
  getDeliveryStatus(messageId: unknown): Promise<DeliveryStatus>;
  getBalance(): Promise<SMSBalance>;
  lookupNumber(phone: unknown): Promise<NumberLookup>;
}
