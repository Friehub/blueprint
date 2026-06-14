// incident_management.ts
// Auto-generated from contracts/incident_management.md
// Do not edit manually

export interface Incident {
  id: string;
  title: unknown;
  description: unknown;
  severity: unknown;
  status: unknown;
  service: unknown;
  createdAt: Timestamp;
}

export interface Incidentnote {
  id: string;
  incidentId: string;
  authorId: string;
  body: unknown;
  createdAt: Timestamp;
}

export interface Runbooklink {
  id: string;
  incidentId: string;
  url: unknown;
  createdAt: Timestamp;
}

export type Incidentseverity = IncidentSeverity = sev1 | sev2 | sev3 | sev4;

export type Incidentstatus = IncidentStatus = open | acknowledged | investigating | mitigated | resolved | closed;

export type Resolution = Resolution = fixed | monitoring | duplicate | false_alarm | wont_fix;

export interface IncidentManagementContract {
  createIncident(input: unknown): Promise<Incident>;
  getIncident(incidentId: unknown): Promise<Incident>;
  listIncidents(input: unknown, options?: unknown): Promise<PaginatedResult<Incident>>;
  acknowledgeIncident(incidentId: unknown, userId: unknown, note?: unknown): Promise<Incident>;
  assignIncident(incidentId: unknown, assigneeId: unknown): Promise<Incident>;
  updateIncidentSeverity(incidentId: unknown, severity: unknown): Promise<Incident>;
  addIncidentNote(incidentId: unknown, note: unknown): Promise<IncidentNote>;
  resolveIncident(incidentId: unknown, resolution: unknown, note?: unknown): Promise<Incident>;
  createRunbookLink(incidentId: unknown, url: unknown, title?: unknown): Promise<RunbookLink>;
}
