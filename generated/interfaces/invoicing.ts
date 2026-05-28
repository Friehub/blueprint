// invoicing.ts
// Auto-generated from contracts/invoicing.md
// Do not edit manually

export interface Invoice {
  id: string;
  number: unknown;
  customerId: string;
  status: unknown;
  currency: unknown;
  subtotal: unknown;
  taxTotal: number;
  discountTotal: number;
  total: unknown;
}

export interface Invoiceline {
  description: unknown;
  quantity: unknown;
  unitAmount: number;
}

export interface Creditnote {
  id: string;
  invoiceId: string;
  amount: unknown;
  reason: unknown;
  status: unknown;
  createdAt: Timestamp;
}

export type Invoicestatus = InvoiceStatus = draft | issued | sent | partially_paid | paid | void | overdue | disputed;

export interface InvoicingContract {
  createInvoice(customerId: unknown, lineItems: unknown, currency: unknown, dueAt?: unknown, metadata?: unknown): Promise<Invoice>;
  issueInvoice(invoiceId: unknown): Promise<Invoice>;
  sendInvoice(invoiceId: unknown, channel?: unknown): Promise<DeliveryResult>;
  getInvoice(invoiceId: unknown): Promise<Invoice>;
  listInvoices(input: unknown, options?: unknown): Promise<PaginatedResult<Invoice>>;
  recordInvoicePayment(invoiceId: unknown, paymentReference: unknown, amount: unknown, paidAt?: unknown): Promise<Invoice>;
  voidInvoice(invoiceId: unknown, reason: unknown): Promise<Invoice>;
  createCreditNote(invoiceId: unknown, adjustments: unknown, reason: unknown): Promise<CreditNote>;
}
