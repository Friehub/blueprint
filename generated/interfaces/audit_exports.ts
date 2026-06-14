// audit_exports.ts
// Auto-generated from contracts/audit_exports.md
// Do not edit manually

export interface Exportjob {
  id: string;
  status: unknown;
  filters: unknown;
  format: unknown;
  requestedBy: unknown;
  createdAt: Timestamp;
}

export type Exportformat = ExportFormat = json | csv | parquet | ndjson;

export type Exportstatus = ExportStatus = queued | running | completed | failed | cancelled | expired;

export interface AuditExportsContract {
  createExportJob(filters: unknown, format: unknown, requestedBy: unknown): Promise<ExportJob>;
  getExportJob(jobId: unknown): Promise<ExportJob>;
  listExportJobs(input: unknown, options?: unknown): Promise<PaginatedResult<ExportJob>>;
  cancelExportJob(jobId: unknown): Promise<ExportJob>;
  downloadExport(jobId: unknown): Promise<SignedUrl>;
}
