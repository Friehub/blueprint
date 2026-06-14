// customer_support.ts
// Auto-generated from contracts/customer_support.md
// Do not edit manually

export interface Ticket {
  id: string;
  customerId: string;
  subject: unknown;
  priority: unknown;
  status: unknown;
  createdAt: Timestamp;
}

export interface Ticketmessage {
  id: string;
  ticketId: string;
  senderId: string;
  message: unknown;
  createdAt: Timestamp;
}

export interface Slaresult {
  ticketId: string;
  isBreached: boolean;
  deadline: unknown;
  timeRemainingSeconds: unknown;
}

export type Ticketpriority = TicketPriority = low | medium | high | urgent;

export type Ticketstatus = TicketStatus = open | pending | resolved | closed;

export interface CustomerSupportContract {
  createTicket(customerId: unknown, subject: unknown, body: unknown, priority: unknown): Promise<Ticket>;
  assignTicket(ticketId: unknown, agentId: unknown): Promise<Ticket>;
  addTicketMessage(ticketId: unknown, senderId: unknown, message: unknown): Promise<TicketMessage>;
  transitionTicketStatus(ticketId: unknown, status: unknown): Promise<Ticket>;
  checkSLA(ticketId: unknown): Promise<SLAResult>;
}
