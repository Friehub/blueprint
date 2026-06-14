// stripe.ts
// Auto-generated adapter for stripe → invoicing
// Do not edit manually

import type { InvoicingContract } from '../interfaces/invoicing';

export class StripeAdapter implements InvoicingContract {
  constructor(private config: {
  api_key: string;
  webhook_secret: string;
  }) {}

  createInvoice(customerId: unknown, lineItems: unknown, currency: unknown, dueAt?: unknown, metadata?: unknown): Promise<Invoice> {
    // TODO: Implement with createInvoice
    throw new Error('Not implemented');
  }
  issueInvoice(invoiceId: unknown): Promise<Invoice> {
    // TODO: Implement with issueInvoice
    throw new Error('Not implemented');
  }
  sendInvoice(invoiceId: unknown, channel?: unknown): Promise<DeliveryResult> {
    // TODO: Implement with sendInvoice
    throw new Error('Not implemented');
  }
  getInvoice(invoiceId: unknown): Promise<Invoice> {
    // TODO: Implement with getInvoice
    throw new Error('Not implemented');
  }
  listInvoices(input: unknown, options?: unknown): Promise<PaginatedResult<Invoice>> {
    // TODO: Implement with listInvoices
    throw new Error('Not implemented');
  }
  recordInvoicePayment(invoiceId: unknown, paymentReference: unknown, amount: unknown, paidAt?: unknown): Promise<Invoice> {
    // TODO: Implement with recordInvoicePayment
    throw new Error('Not implemented');
  }
  voidInvoice(invoiceId: unknown, reason: unknown): Promise<Invoice> {
    // TODO: Implement with voidInvoice
    throw new Error('Not implemented');
  }
  createCreditNote(invoiceId: unknown, adjustments: unknown, reason: unknown): Promise<CreditNote> {
    // TODO: Implement with createCreditNote
    throw new Error('Not implemented');
  }
}
