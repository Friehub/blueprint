// jobs.ts
// Auto-generated from contracts/jobs.md
// Do not edit manually

export type JobId = string;

export type JobExecutionId = string;

export type JobScheduleId = string;

export type JobStatus = "REGISTERED" | "SCHEDULED" | "DISABLED";

export type RetryPolicy = {
maxAttempts: number;
backoffStrategy: "FIXED" | "EXPONENTIAL" | "LINEAR";
backoffBaseSeconds: number;
maxBackoffSeconds: number;
};

export type RegisterJobInput = {
name: string;                      // Unique, human-readable identifier
description?: string;
handlerRef: string;                // Implementation-defined handler identifier
timeoutSeconds: number;
retryPolicy: RetryPolicy;
tags?: Record<string, string>;
};

export type ScheduleJobInput = {
jobId: JobId;
cronExpression?: string;           // Standard 5-field cron
intervalSeconds?: number;          // Alternative to cron for fixed intervals
timezone?: string;                 // Defaults to UTC
startAt?: Timestamp;
endAt?: Timestamp;
};

export type Job = {
jobId: JobId;
name: string;
description?: string;
handlerRef: string;
timeoutSeconds: number;
retryPolicy: RetryPolicy;
status: JobStatus;
schedule?: JobSchedule;
tags?: Record<string, string>;
createdAt: Timestamp;
updatedAt: Timestamp;
};

export type JobSchedule = {
scheduleId: JobScheduleId;
jobId: JobId;
cronExpression?: string;
intervalSeconds?: number;
timezone: string;
nextRunAt?: Timestamp;
lastRunAt?: Timestamp;
startAt?: Timestamp;
endAt?: Timestamp;
};

export type JobExecution = {
executionId: JobExecutionId;
jobId: JobId;
status: ExecutionStatus;
attempt: number;
triggeredAt: Timestamp;
startedAt?: Timestamp;
completedAt?: Timestamp;
durationMs?: number;
payload?: Record<string, unknown>;
errorMessage?: string;
logRef?: string;                   // Reference to structured log output
};

export type ListJobsInput = {
status?: JobStatus;
tags?: Record<string, string>;
pagination: PaginationInput;
};

export type ListExecutionsInput = {
jobId: JobId;
status?: ExecutionStatus;
fromDate?: Timestamp;
toDate?: Timestamp;
pagination: PaginationInput;
};

export interface JobsContract {
  registerJob(input: RegisterJobInput): Promise<Job>;
  scheduleJob(input: ScheduleJobInput): Promise<JobSchedule>;
  triggerJob(jobId: JobId, payload?: Record<string, unknown>): Promise<JobExecution>;
  disableJob(jobId: JobId): Promise<JobSchedule>;
  enableJob(jobId: JobId): Promise<JobSchedule>;
  getJob(jobId: JobId): Promise<Job>;
  listJobs(input: ListJobsInput): Promise<PaginatedList<Job>>;
  getExecution(executionId: JobExecutionId): Promise<JobExecution>;
  listExecutions(input: ListExecutionsInput): Promise<PaginatedList<JobExecution>>;
  cancelExecution(executionId: JobExecutionId): Promise<void>;
}
