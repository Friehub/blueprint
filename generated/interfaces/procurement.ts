// procurement.ts
// Auto-generated from contracts/procurement.md
// Do not edit manually

export interface Requisition {
  id: string;
  requestedBy: unknown;
  items: unknown;
  budgetCode: unknown;
  total: unknown;
  status: unknown;
  createdAt: Timestamp;
}

export interface Purchaseorder {
  id: string;
  requisitionId: string;
  vendorId: string;
  total: unknown;
  status: unknown;
  generatedAt: Timestamp;
}

export interface Vendorinvoice {
  id: string;
  poId: string;
  total: unknown;
  invoiceNumber: unknown;
  status: unknown;
  dueAt: Timestamp;
  recordedAt: Timestamp;
}

export interface Requisitionitem {
  description: unknown;
  quantity: unknown;
  unitPrice: number;
}

export type Requisitionstatus = RequisitionStatus = draft | pending_approval | approved | rejected;

export type Purchaseorderstatus = PurchaseOrderStatus = drafted | sent | received | cancelled;

export type Vendorinvoicestatus = VendorInvoiceStatus = unpaid | paid | disputed;

export interface ProcurementContract {
  createRequisition(requestedBy: unknown, items: unknown, budgetCode: unknown): Promise<Requisition>;
  approveRequisition(requisitionId: unknown, approverId: unknown): Promise<Requisition>;
  generatePurchaseOrder(requisitionId: unknown, vendorId: unknown): Promise<PurchaseOrder>;
  recordVendorInvoice(poId: unknown, invoiceDetails: unknown): Promise<VendorInvoice>;
}
