// stripe.test.ts
// Auto-generated conformance test for stripe → invoicing
// Do not edit manually

import { StripeAdapter } from '../adapters/invoicing/stripe';
import type { InvoicingContract } from '../interfaces/invoicing';

describe('StripeAdapter implements InvoicingContract', () => {
  const adapter: InvoicingContract = new StripeAdapter({
    api_key: 'test',
    webhook_secret: 'test'
  });

  it('has createInvoice method', () => {
    expect(typeof adapter.createInvoice).toBe('function');
  });

  it('has issueInvoice method', () => {
    expect(typeof adapter.issueInvoice).toBe('function');
  });

  it('has sendInvoice method', () => {
    expect(typeof adapter.sendInvoice).toBe('function');
  });

  it('has getInvoice method', () => {
    expect(typeof adapter.getInvoice).toBe('function');
  });

  it('has listInvoices method', () => {
    expect(typeof adapter.listInvoices).toBe('function');
  });

  it('has recordInvoicePayment method', () => {
    expect(typeof adapter.recordInvoicePayment).toBe('function');
  });

  it('has voidInvoice method', () => {
    expect(typeof adapter.voidInvoice).toBe('function');
  });

  it('has createCreditNote method', () => {
    expect(typeof adapter.createCreditNote).toBe('function');
  });

});
