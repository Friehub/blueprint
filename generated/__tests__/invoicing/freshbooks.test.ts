// freshbooks.test.ts
// Auto-generated conformance test for freshbooks → invoicing
// Do not edit manually

import { FreshbooksAdapter } from '../adapters/invoicing/freshbooks';
import type { InvoicingContract } from '../interfaces/invoicing';

describe('FreshbooksAdapter implements InvoicingContract', () => {
  const adapter: InvoicingContract = new FreshbooksAdapter({
    client_id: 'test',
    client_secret: 'test',
    access_token: 'test',
    refresh_token: 'test'
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
