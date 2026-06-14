// opsgenie.ts
// Auto-generated adapter for opsgenie → incident_management
// Do not edit manually

import type { IncidentManagementContract } from '../interfaces/incident_management';

export class OpsgenieAdapter implements IncidentManagementContract {
  constructor(private config: {
  api_key: string;
  team_id: string;
  service_id: string;
  }) {}

  createIncident(input: unknown): Promise<Incident> {
    // TODO: Implement with createIncident
    throw new Error('Not implemented');
  }
  getIncident(incidentId: unknown): Promise<Incident> {
    // TODO: Implement with getIncident
    throw new Error('Not implemented');
  }
  listIncidents(input: unknown, options?: unknown): Promise<PaginatedResult<Incident>> {
    // TODO: Implement with listIncidents
    throw new Error('Not implemented');
  }
  acknowledgeIncident(incidentId: unknown, userId: unknown, note?: unknown): Promise<Incident> {
    // TODO: Implement with acknowledgeIncident
    throw new Error('Not implemented');
  }
  assignIncident(incidentId: unknown, assigneeId: unknown): Promise<Incident> {
    // TODO: Implement with assignIncident
    throw new Error('Not implemented');
  }
  updateIncidentSeverity(incidentId: unknown, severity: unknown): Promise<Incident> {
    // TODO: Implement with updateIncidentSeverity
    throw new Error('Not implemented');
  }
  addIncidentNote(incidentId: unknown, note: unknown): Promise<IncidentNote> {
    // TODO: Implement with addIncidentNote
    throw new Error('Not implemented');
  }
  resolveIncident(incidentId: unknown, resolution: unknown, note?: unknown): Promise<Incident> {
    // TODO: Implement with resolveIncident
    throw new Error('Not implemented');
  }
  createRunbookLink(incidentId: unknown, url: unknown, title?: unknown): Promise<RunbookLink> {
    // TODO: Implement with createRunbookLink
    throw new Error('Not implemented');
  }
}
