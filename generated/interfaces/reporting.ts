// reporting.ts
// Auto-generated from contracts/reporting.md
// Do not edit manually

export type ReportId = string;

export type ReportRunId = string;

export type ReportScheduleId = string;

export type ReportFormat = "CSV" | "XLSX" | "JSON" | "PDF";

export type ReportStatus = "DRAFT" | "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "EXPIRED";

export type ReportDefinition = {
name: string;
description?: string;
dataSource: string;          // Identifier of the domain query this report executes
filters: ReportFilter[];
columns: ReportColumn[];
format: ReportFormat;
ttlSeconds: number;          // How long the artifact is retained after completion
};

export type ReportFilter = {
field: string;
operator: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "in" | "between";
value: unknown;
};

export type ReportColumn = {
field: string;
label: string;
type: "string" | "number" | "boolean" | "datetime" | "currency";
};

export type Report = ReportDefinition & {

export type ReportRun = {
runId: ReportRunId;
reportId: ReportId;
status: ReportStatus;
requestedAt: Timestamp;
startedAt?: Timestamp;
completedAt?: Timestamp;
downloadUrl?: string;
downloadUrlExpiresAt?: Timestamp;
rowCount?: number;
errorMessage?: string;
};

export type QueueReportInput = {
reportId: ReportId;
parameterOverrides?: Record<string, unknown>;
requestedBy: UserId;
};

export type ScheduleReportInput = {
reportId: ReportId;
cronExpression: string;
timezone: string;
deliveryChannels: ReportDeliveryChannel[];
};

export type ReportDeliveryChannel = {
type: "EMAIL" | "WEBHOOK" | "STORAGE";
target: string;              // Email address, webhook URL, or storage path
};

export type ReportSchedule = {
scheduleId: ReportScheduleId;
reportId: ReportId;
cronExpression: string;
timezone: string;
active: boolean;
nextRunAt: Timestamp;
deliveryChannels: ReportDeliveryChannel[];
};

export type ListReportRunsInput = {
reportId: ReportId;
status?: ReportStatus;
fromDate?: Timestamp;
toDate?: Timestamp;
pagination: PaginationInput;
};

export interface ReportingContract {
  defineReport(input: ReportDefinition): Promise<Report>;
  queueReport(input: QueueReportInput): Promise<ReportRun>;
  getReportRun(runId: ReportRunId): Promise<ReportRun>;
  listReportRuns(input: ListReportRunsInput): Promise<PaginatedList<ReportRun>>;
  scheduleReport(input: ScheduleReportInput): Promise<ReportSchedule>;
  cancelSchedule(scheduleId: ReportScheduleId): Promise<void>;
  downloadReport(runId: ReportRunId): Promise<SignedUrl>;
  deleteReport(reportId: ReportId): Promise<void>;
}
