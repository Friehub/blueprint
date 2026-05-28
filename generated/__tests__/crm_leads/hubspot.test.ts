// hubspot.test.ts
// Auto-generated conformance test for hubspot → crm_leads
// Do not edit manually

import { HubspotAdapter } from '../adapters/crm_leads/hubspot';
import type { CrmLeadsContract } from '../interfaces/crm_leads';

describe('HubspotAdapter implements CrmLeadsContract', () => {
  const adapter: CrmLeadsContract = new HubspotAdapter({
    api_key: 'test'
  });

  it('has createLead method', () => {
    expect(typeof adapter.createLead).toBe('function');
  });

  it('has updateLeadStatus method', () => {
    expect(typeof adapter.updateLeadStatus).toBe('function');
  });

  it('has createDeal method', () => {
    expect(typeof adapter.createDeal).toBe('function');
  });

  it('has updateDealStage method', () => {
    expect(typeof adapter.updateDealStage).toBe('function');
  });

  it('has assignOwner method', () => {
    expect(typeof adapter.assignOwner).toBe('function');
  });

});
