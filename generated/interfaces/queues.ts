// queues.ts
// Auto-generated from contracts/queues.md
// Do not edit manually

export interface Job {
  id: string;
  queueName: string;
  payload: unknown;
  status: unknown;
  attempts: unknown;
  maxAttempts: unknown;
  runAt: Timestamp;
}

export type Jobstatus = JobStatus = waiting | active | completed | failed | cancelled | delayed;

export interface Queuestats {
  waiting: unknown;
  active: unknown;
  completed: unknown;
  failed: unknown;
  delayed: unknown;
}

export interface Joboptions {

}

export interface QueuesContract {
  enqueue(queueName: unknown, payload: unknown, options?: unknown): Promise<Job>;
  enqueueBulk(queueName: unknown, payloads: unknown): Promise<Job[]>;
  scheduleJob(queueName: unknown, payload: unknown, runAt: unknown): Promise<Job>;
  cancelJob(jobId: unknown): Promise<void>;
  getJob(jobId: unknown): Promise<Job>;
  getJobStatus(jobId: unknown): Promise<JobStatus>;
  retryJob(jobId: unknown): Promise<Job>;
  getQueueStats(queueName: unknown): Promise<QueueStats>;
  purgeQueue(queueName: unknown): Promise<void>;
}
