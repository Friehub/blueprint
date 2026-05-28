// returns.ts
// Auto-generated from contracts/returns.md
// Do not edit manually

export interface Returnauthorization {
  id: string;
  orderId: string;
  status: unknown;
  items: unknown;
  reason: unknown;
  createdAt: Timestamp;
}

export interface Returnitem {
  lineId: string;
  quantity: unknown;
  condition?: string;
}

export type Returndisposition = ReturnDisposition = restock | refurbish | discard | return_to_vendor | refund_only;

export type Returnstatus = ReturnStatus = requested | approved | rejected | in_transit | received | inspected | closed | cancelled;

export interface ReturnsContract {
  requestReturn(orderId: unknown, items: unknown, reason: unknown, metadata?: unknown): Promise<ReturnAuthorization>;
  getReturn(returnId: unknown): Promise<ReturnAuthorization>;
  listReturns(input: unknown, options?: unknown): Promise<PaginatedResult<ReturnAuthorization>>;
  approveReturn(returnId: unknown): Promise<ReturnAuthorization>;
  rejectReturn(returnId: unknown, reason: unknown): Promise<ReturnAuthorization>;
  receiveReturn(returnId: unknown, receivedItems: unknown, metadata?: unknown): Promise<ReturnAuthorization>;
  inspectReturn(returnId: unknown, disposition: unknown): Promise<ReturnAuthorization>;
  closeReturn(returnId: unknown): Promise<ReturnAuthorization>;
}
