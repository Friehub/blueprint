# Module Contract: `invoicing`

**Version:** 0.1.0

---

### `invoicing`
Customer invoice generation, issue, delivery, payment application, and credit note management.

**Functions**
```
createInvoice(customer_id: any, line_items: any, currency: string, due_at?: any, metadata?: any) → Invoice
issueInvoice(invoice_id: any) → Invoice
sendInvoice(invoice_id: any, channel?: any) → DeliveryResult
getInvoice(invoice_id: any) → Invoice
listInvoices(input: any, options?: any) → PaginatedResult<Invoice>
recordInvoicePayment(invoice_id: any, payment_reference: any, amount: number, paid_at?: any) → Invoice
voidInvoice(invoice_id: any, reason: string) → Invoice
createCreditNote(invoice_id: any, adjustments: any, reason: string) → CreditNote
```

**Types**
```
Invoice { id, number, customer_id, status, currency, subtotal, tax_total, discount_total, total, due_at?, issued_at?, paid_at?, metadata? }
InvoiceLine { description, quantity, unit_amount, tax_amount?, discount_amount?, reference? }
CreditNote { id, invoice_id, amount, reason, status, created_at }
InvoiceStatus = draft | issued | sent | partially_paid | paid | void | overdue | disputed
```

**Invariants**
- Invoice numbers must be unique within the issuer scope and immutable once issued.
- Issued invoices must not be edited directly; corrections must use voiding or credit notes.
- Invoice totals must equal line totals after tax and discount adjustments.

**Providers:** custom accounts receivable system, ERP invoice modules, QuickBooks, Xero, FreshBooks, NetSuite

---

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Invoice number assignment and status transitions must be strongly consistent.
- **Idempotency:** `issueInvoice`, `sendInvoice`, and `recordInvoicePayment` must be idempotent on the invoice reference and payment reference.
- **Temporal Constraints:** Overdue state is derived from `due_at`; invoice retention and archive windows must be documented by the adapter.
- **Storage Model:** Durable invoice register with credit-note history and payment application trail.
- **Dependencies:** `payments`, `ledger`, `notifications`, `storage`, `audit_log`, `queues`.
- **Errors:** `INVOICE_NOT_FOUND`, `INVOICE_ALREADY_ISSUED`, `INVOICE_NOT_EDITABLE`, `INVOICE_NUMBER_CONFLICT`, `PAYMENT_ALREADY_APPLIED`, `CREDIT_NOTE_INVALID`.
