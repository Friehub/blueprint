# Module: reporting

**Version:** 0.1.0
**Part:** VI — Platform Operations

## Purpose

Defines the interface for generating, scheduling, and exporting structured reports from aggregated domain data. A report is a bounded, named query over one or more domain data sources, rendered into a consumable format. This module does not own the underlying data — it owns the report definition, execution lifecycle, and delivery.

---

## State Machine

```
DRAFT → QUEUED → RUNNING → COMPLETED
                          → FAILED
COMPLETED → EXPIRED
```

Transitions:
- `DRAFT → QUEUED`: `queueReport` called with valid definition
- `QUEUED → RUNNING`: worker picks up the job
- `RUNNING → COMPLETED`: data resolved and rendered successfully
- `RUNNING → FAILED`: timeout or data source error
- `COMPLETED → EXPIRED`: TTL elapsed; artifact deleted from storage

---

## Functions

### `defineReport(input: ReportDefinition) → Report`
Creates a named, reusable report template. Does not execute it.

### `queueReport(input: QueueReportInput) → ReportRun`
Schedules a report for async execution. Returns a `ReportRun` with status `QUEUED`.

### `getReportRun(runId: ReportRunId) → ReportRun`
Returns current status and, if `COMPLETED`, a signed download URL for the artifact.

### `listReportRuns(input: ListReportRunsInput) → PaginatedList<ReportRun>`
Returns runs for a given report definition, filtered by status or date range.

### `scheduleReport(input: ScheduleReportInput) → ReportSchedule`
Attaches a cron expression to a report definition, creating a recurring execution schedule.

### `cancelSchedule(scheduleId: ReportScheduleId) → void`
Deactivates a recurring schedule. Does not cancel in-flight runs.

### `downloadReport(runId: ReportRunId) → SignedUrl`
Returns a time-limited URL to the rendered artifact. Errors if run is not `COMPLETED`.

### `deleteReport(reportId: ReportId) → void`
Soft-deletes a report definition and cancels all associated schedules. Existing completed runs are retained until their TTL expires.

---

## Types

```typescript
type ReportId = string;
type ReportRunId = string;
type ReportScheduleId = string;

type ReportFormat = "CSV" | "XLSX" | "JSON" | "PDF";

type ReportStatus = "DRAFT" | "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "EXPIRED";

type ReportDefinition = {
  name: string;
  description?: string;
  dataSource: string;          // Identifier of the domain query this report executes
  filters: ReportFilter[];
  columns: ReportColumn[];
  format: ReportFormat;
  ttlSeconds: number;          // How long the artifact is retained after completion
};

type ReportFilter = {
  field: string;
  operator: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "in" | "between";
  value: unknown;
};

type ReportColumn = {
  field: string;
  label: string;
  type: "string" | "number" | "boolean" | "datetime" | "currency";
};

type Report = ReportDefinition & {
  reportId: ReportId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type ReportRun = {
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

type QueueReportInput = {
  reportId: ReportId;
  parameterOverrides?: Record<string, unknown>;
  requestedBy: UserId;
};

type ScheduleReportInput = {
  reportId: ReportId;
  cronExpression: string;
  timezone: string;
  deliveryChannels: ReportDeliveryChannel[];
};

type ReportDeliveryChannel = {
  type: "EMAIL" | "WEBHOOK" | "STORAGE";
  target: string;              // Email address, webhook URL, or storage path
};

type ReportSchedule = {
  scheduleId: ReportScheduleId;
  reportId: ReportId;
  cronExpression: string;
  timezone: string;
  active: boolean;
  nextRunAt: Timestamp;
  deliveryChannels: ReportDeliveryChannel[];
};

type ListReportRunsInput = {
  reportId: ReportId;
  status?: ReportStatus;
  fromDate?: Timestamp;
  toDate?: Timestamp;
  pagination: PaginationInput;
};
```

---

## Invariants

1. A `ReportRun` download URL must only be returned when status is `COMPLETED`.
2. Artifact storage references must be signed and time-limited; no permanent public URLs are issued.
3. A cancelled schedule does not retroactively affect runs already in `QUEUED` or `RUNNING` state.
4. Report definitions are immutable once a `ReportRun` references them; updates create a new version.
5. `ttlSeconds` is enforced by the implementation; the module must delete artifacts after TTL regardless of download activity.
6. `cronExpression` must be validated against a known cron grammar before `scheduleReport` returns.

---

## Events Emitted

- `report.run.queued` — run enters the queue
- `report.run.started` — worker begins execution
- `report.run.completed` — artifact is ready
- `report.run.failed` — execution failed; includes `errorMessage`
- `report.schedule.created`
- `report.schedule.cancelled`

---

## System-Level Integrations

- **Idempotency:** `queueReport` is idempotent on `(reportId, requestedBy, parameterOverrides)` within a 60-second window; duplicate calls return the existing run.
- **Consistency:** Report execution reads from a read replica or data warehouse; it does not read from the primary transactional store.
- **Observability:** Each run emits a trace with spans for queue wait time, data fetch duration, and render duration.
- **Dependencies:** `storage` (artifact persistence), `queues` (async execution dispatch), `notifications` or `emails` (delivery channels), `auth` (caller identity).
- **Errors:** `REPORT_NOT_FOUND`, `REPORT_RUN_NOT_FOUND`, `REPORT_NOT_COMPLETE`, `INVALID_CRON_EXPRESSION`, `SCHEDULE_NOT_FOUND`, `DATA_SOURCE_UNAVAILABLE`.
- **Providers (adapter examples):** Apache Superset, Metabase (embed), AWS Athena, BigQuery, custom SQL runners.
