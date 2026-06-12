# Module: jobs

**Version:** 0.1.0
**Part:** III -- Data and State

## Purpose

Defines the interface for registering, scheduling, and monitoring named background jobs. A job is a discrete, named unit of work with a defined schedule, retry policy, and execution record. This module is distinct from `queues`, which handles event-driven message consumption. Jobs are time-driven -- they fire on a schedule or on explicit trigger, independent of any incoming message.

---

## State Machine

```
REGISTERED → SCHEDULED → PENDING → RUNNING → SUCCEEDED
                                             → FAILED → RETRYING → RUNNING
                                                        RETRYING → EXHAUSTED
SCHEDULED → DISABLED
DISABLED → SCHEDULED
```

Transitions:
- `REGISTERED → SCHEDULED`: `scheduleJob` called with a valid cron or interval
- `SCHEDULED → PENDING`: clock fires; job enters the execution queue
- `PENDING → RUNNING`: worker picks up the pending execution
- `RUNNING → SUCCEEDED`: handler completes with no error
- `RUNNING → FAILED`: handler throws or times out
- `FAILED → RETRYING`: retry policy allows another attempt; backoff is applied
- `RETRYING → EXHAUSTED`: all retry attempts consumed
- `SCHEDULED ↔ DISABLED`: `disableJob` / `enableJob`

---

## Functions

### `registerJob(input: RegisterJobInput) → Job`
Declares a named job with its handler reference, retry policy, and timeout. Does not schedule it.

### `scheduleJob(input: ScheduleJobInput) → JobSchedule`
Attaches a schedule (cron expression or fixed interval) to a registered job.

### `triggerJob(jobId: JobId, payload?: Record<string, unknown>) → JobExecution`
Fires an immediate, one-off execution of a registered job outside its normal schedule.

### `disableJob(jobId: JobId) → JobSchedule`
Pauses all future scheduled triggers. In-flight executions are not interrupted.

### `enableJob(jobId: JobId) → JobSchedule`
Resumes scheduled triggers from the next due time.

### `getJob(jobId: JobId) → Job`
Returns the job definition and current schedule status.

### `listJobs(input: ListJobsInput) → PaginatedList<Job>`
Lists all registered jobs, optionally filtered by status.

### `getExecution(executionId: JobExecutionId) → JobExecution`
Returns the result and logs for a specific execution.

### `listExecutions(input: ListExecutionsInput) → PaginatedList<JobExecution>`
Returns execution history for a job, ordered by most recent first.

### `cancelExecution(executionId: JobExecutionId) → void`
Requests cancellation of a `PENDING` execution. Has no effect on `RUNNING` executions; implementations may support cooperative cancellation via a signal.

---

## Types

```typescript
type JobId = string;
type JobExecutionId = string;
type JobScheduleId = string;

type JobStatus = "REGISTERED" | "SCHEDULED" | "DISABLED";

type ExecutionStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "RETRYING"
  | "EXHAUSTED"
  | "CANCELLED";

type RetryPolicy = {
  maxAttempts: number;
  backoffStrategy: "FIXED" | "EXPONENTIAL" | "LINEAR";
  backoffBaseSeconds: number;
  maxBackoffSeconds: number;
};

type RegisterJobInput = {
  name: string;                      // Unique, human-readable identifier
  description?: string;
  handlerRef: string;                // Implementation-defined handler identifier
  timeoutSeconds: number;
  retryPolicy: RetryPolicy;
  tags?: Record<string, string>;
};

type ScheduleJobInput = {
  jobId: JobId;
  cronExpression?: string;           // Standard 5-field cron
  intervalSeconds?: number;          // Alternative to cron for fixed intervals
  timezone?: string;                 // Defaults to UTC
  startAt?: Timestamp;
  endAt?: Timestamp;
};

type Job = {
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

type JobSchedule = {
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

type JobExecution = {
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

type ListJobsInput = {
  status?: JobStatus;
  tags?: Record<string, string>;
  pagination: PaginationInput;
};

type ListExecutionsInput = {
  jobId: JobId;
  status?: ExecutionStatus;
  fromDate?: Timestamp;
  toDate?: Timestamp;
  pagination: PaginationInput;
};
```

---

## Invariants

1. `name` is globally unique within a tenant; duplicate registration returns the existing job.
2. A job may have at most one active schedule; calling `scheduleJob` on an already-scheduled job replaces the existing schedule.
3. Either `cronExpression` or `intervalSeconds` must be provided to `scheduleJob`, but not both.
4. `triggerJob` creates an execution regardless of whether the job is `DISABLED`; manual triggers bypass the schedule gate.
5. Retries are subject to the retry policy of the job definition at the time of the original execution, not any updated policy applied later.
6. `timeoutSeconds` is enforced by the worker; an execution exceeding the timeout transitions to `FAILED` with an appropriate error message.
7. Execution logs must be retained for a minimum of 30 days and must be queryable by `executionId`.

---

## Events Emitted

- `job.registered`
- `job.scheduled`
- `job.enabled`
- `job.disabled`
- `job.execution.started`
- `job.execution.succeeded` -- includes `durationMs`
- `job.execution.failed` -- includes `attempt`, `errorMessage`
- `job.execution.exhausted` -- all retries consumed

---

## System-Level Integrations

- **Idempotency:** `triggerJob` with the same `(jobId, payload)` within a configurable deduplication window returns the existing pending execution rather than creating a new one.
- **Consistency:** Job definitions are stored durably before `registerJob` returns; no in-memory-only registrations.
- **Runtime delivery:** Executions are `at_least_once` unless the deployment explicitly documents a stronger guarantee.
- **Worker scaling:** Worker concurrency must be configurable per job class or schedule group.
- **Multi-region:** The deployment must declare whether scheduled execution is single-region or active/passive; duplicate firing across regions must be deduplicated.
- **Observability:** Each execution is a trace root; spans cover queue wait, execution, and retry backoff intervals.
  - **Telemetry Metrics:**
  ```
  gensense_jobs_registered_total            { status }
  gensense_jobs_executions_total            { job_name, status }
  gensense_jobs_execution_duration_ms       histogram { job_name }
  gensense_jobs_execution_queue_wait_ms     histogram { job_name }
  gensense_jobs_retry_attempts_total        { job_name }
  gensense_jobs_exhausted_total             { job_name }
  gensense_jobs_pending_executions          gauge { job_name }
  ```
- **Dependencies:** `queues` (underlying dispatch mechanism for pending executions), `audit_log` (execution history), `notifications` (on exhausted retries).
- **Errors:** `JOB_NOT_FOUND`, `EXECUTION_NOT_FOUND`, `INVALID_CRON_EXPRESSION`, `CONFLICTING_SCHEDULE`, `EXECUTION_NOT_CANCELLABLE`.
- **Providers (adapter examples):** BullMQ, Temporal, Inngest, pg-boss, AWS EventBridge Scheduler, Quirrel.

### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return provider_error, do not retry indefinitely |
| Provider rate limited | Respect Retry-After header, apply exponential backoff |
| Partial success in batch | Return partial_success with succeeded[] and failed[] |
| Execution timeout exceeded | Transition execution to FAILED with timeout error message |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value to ExecutionStatus: non-breaking if consumers use exhaustive enum handling; breaking otherwise

## Runtime Constraints

- **Retry budget:** `RetryPolicy.maxAttempts` is the authoritative cap; once exhausted, the execution must move to `EXHAUSTED` and be recorded for review.
- **Dead-letter handling:** Exhausted executions must be retained in an operator-queryable failed store or dead-letter view.
- **Payload size:** `triggerJob` payloads should stay under 256 KiB unless the deployment documents an out-of-band payload strategy.
- **Backpressure:** If the downstream execution queue is saturated, scheduling should defer or reject predictably rather than enqueueing unbounded work.
