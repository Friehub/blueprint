# Module Contract: `procurement`

**Version:** 0.1.0

---

### `procurement`
Business-to-business purchase requisitions, approval chains, purchase order (PO) generation, and vendor invoices.

**Functions**
```
createRequisition(requested_by, items, budget_code) → Requisition
approveRequisition(requisition_id, approver_id) → Requisition
generatePurchaseOrder(requisition_id, vendor_id) → PurchaseOrder
recordVendorInvoice(po_id, invoice_details) → VendorInvoice
```

**Types**
```
Requisition { id, requested_by, items, budget_code, total, status, created_at }
PurchaseOrder { id, requisition_id, vendor_id, total, status, generated_at }
VendorInvoice { id, po_id, total, invoice_number, status, due_at, recorded_at }
RequisitionItem { description, quantity, unit_price }

RequisitionStatus = draft | pending_approval | approved | rejected
PurchaseOrderStatus = drafted | sent | received | cancelled
VendorInvoiceStatus = unpaid | paid | disputed
```
*Note on Money:* All value/pricing fields must be represented as positive integers in minor currency units (cents).

**Invariants**
- **Monotonic Total Calculation**: Requisition totals must exactly equal the sum of item quantities multiplied by their unit prices. Gaps are not permitted.
- **Workflow State Transition Lock**: A purchase order (`generatePurchaseOrder`) can only be generated for a requisition in the `approved` state.
- **Vendor Invoice Balance**: The recorded vendor invoice total must align with the corresponding purchase order total. Discrepancies must flag the invoice as `disputed` automatically.

**Providers:** custom SQL schemas, SAP Ariba API, Oracle Procurement, Coupa API

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Financial approval transitions and budget deduction counts must be strongly consistent to prevent double-spending a single budget code.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Required Functions:**
  - `createRequisition(requested_by, items, budget_code, idempotency_key?)`

### Error Taxonomy
### Module-Specific Errors
```
approveRequisition:
    budget_limit_exceeded:     Requisition total exceeds the budget code allocation limit | return 403 Forbidden
    already_approved:          The requisition has already been processed | return existing approval
    unauthorized_approver:     The user ID does not have approval rights on this budget code | reject
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createRequisition       → procurement.requisition.created   { requisition_id, total }
approveRequisition      → procurement.requisition.approved  { requisition_id, approver_id }
generatePurchaseOrder   → procurement.po.generated          { po_id, vendor_id, total }
recordVendorInvoice     → procurement.invoice.recorded      { invoice_id, po_id, total }
```

### Temporal Constraints
```
Requisition (pending_approval state):
    max_duration:   5 days
    on_expiry:      alert procurement manager, escalate to fallback approver
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `procurement.<function>`.
* **Telemetry Metrics:**
```
gensense_procurement_requisition_volume_total   counter { budget_code }
gensense_procurement_po_value_cents_total       counter { vendor_id }
gensense_procurement_pending_approvals_total     gauge
```
* **LO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** users (for employee and approver records)
* **Emits To:** events
* **Recommends:** notifications, audit_log, billing
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `created_at DESC` on purchase orders.
