// crm_leads.ts
// Auto-generated from contracts/crm_leads.md
// Do not edit manually

export interface Lead {
  id: string;
  contactInfo: unknown;
  status: unknown;
  source: unknown;
  createdAt: Timestamp;
}

export interface Contactinfo {
  name: unknown;
  email: unknown;
}

export interface Deal {
  id: string;
  leadId: string;
  value: unknown;
  currency: unknown;
  stage: unknown;
  createdAt: Timestamp;
}

export type Leadstatus = LeadStatus = new | contacted | qualified | lost;

export type Dealstage = DealStage = discovery | proposal | negotiation | won | lost;

export interface CrmLeadsContract {
  createLead(contactInfo: unknown, source: unknown, metadata?: unknown): Promise<Lead>;
  updateLeadStatus(leadId: unknown, status: unknown): Promise<Lead>;
  createDeal(leadId: unknown, value: unknown, currency: unknown, stage: unknown): Promise<Deal>;
  updateDealStage(dealId: unknown, stage: unknown): Promise<Deal>;
  assignOwner(leadId: unknown, ownerId: unknown): Promise<Lead>;
}
