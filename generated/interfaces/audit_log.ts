// audit_log.ts
// Auto-generated from contracts/audit_log.md
// Do not edit manually

export interface Auditevent {
  id: string;
  actor: unknown;
  action: unknown;
  resource: unknown;
  metadata: unknown;
  createdAt: Timestamp;
}

export interface Auditactor {
  type: user | system | api_key;
  id: string;
}

export interface Auditresource {
  type: unknown;
  id: string;
}

export type Exportformat = ExportFormat = json | csv;

export interface AuditLogContract {
  recordEvent(event: unknown): Promise<AuditEvent>;
  queryEvents(filters: unknown, options?: unknown): Promise<PaginatedResult<AuditEvent>>;
  getEventsByActor(actorId: unknown, options?: unknown): Promise<PaginatedResult<AuditEvent>>;
  getEventsByResource(resourceType: unknown, resourceId: unknown): Promise<AuditEvent[]>;
  exportAuditLog(filters: unknown, format: unknown): Promise<ExportJob>;
  getEvent(eventId: unknown): Promise<AuditEvent>;
}
