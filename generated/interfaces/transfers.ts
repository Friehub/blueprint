// transfers.ts
// Auto-generated from contracts/transfers.md
// Do not edit manually

export interface Transfer {
  id: string;
  sourceAccountId: string;
  destAccountId: string;
  amount: unknown;
  status: unknown;
  routingDetails: unknown;
  createdAt: Timestamp;
}

export interface Counterparty {
  id: string;
  name: unknown;
  type: unknown;
  bankRoutingNumber: unknown;
  bankAccountNumber: unknown;
  status: unknown;
  createdAt: Timestamp;
}

export interface Routingdetails {
  method: unknown;
}

export interface Inboundtransfer {
  id: string;
  destAccountId: string;
  amount: unknown;
  status: unknown;
  routingDetails: unknown;
  externalReference: unknown;
  createdAt: Timestamp;
}

export type Transferstatus = TransferStatus = initiated | clearing | settled | failed;

export type Inboundtransferstatus = InboundTransferStatus = received | matched | confirmed | failed | reversed;

export type Counterpartytype = CounterpartyType = individual | corporate;

export type Counterpartystatus = CounterpartyStatus = active | suspended | pending_verification;

export type Transfermethod = TransferMethod = internal | ach | wire | sepa;

export interface TransfersContract {
  initiateTransfer(sourceAccountId: unknown, destAccountId: unknown, amount: unknown, routingDetails: unknown): Promise<Transfer>;
  getTransfer(transferId: unknown): Promise<Transfer>;
  transitionTransferStatus(transferId: unknown, status: unknown, errorDetails?: unknown): Promise<Transfer>;
  registerCounterparty(details: unknown): Promise<Counterparty>;
  recordInboundTransfer(destAccountId: unknown, amount: unknown, routingDetails: unknown, externalReference: unknown, metadata?: unknown): Promise<InboundTransfer>;
  getInboundTransfer(inboundTransferId: unknown): Promise<InboundTransfer>;
  listInboundTransfers(input: unknown, options?: unknown): Promise<PaginatedResult<InboundTransfer>>;
  confirmInboundTransfer(inboundTransferId: unknown): Promise<InboundTransfer>;
}
