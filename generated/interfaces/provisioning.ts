// provisioning.ts
// Auto-generated from contracts/provisioning.md
// Do not edit manually

export interface Provisioningjob {
  id: string;
  accountId: string;
  templateId: string;
  status: unknown;
  stepsTotal: number;
  stepsCompleted: unknown;
  createdAt: Timestamp;
}

export interface Provisioningstep {
  id: string;
  key: unknown;
  status: unknown;
}

export type Provisioningstatus = ProvisioningStatus = pending | running | paused | completed | failed | cancelled;

export interface ProvisioningContract {
  createProvisioningJob(accountId: unknown, templateId: unknown, requestedBy: unknown, metadata?: unknown): Promise<ProvisioningJob>;
  getProvisioningJob(jobId: unknown): Promise<ProvisioningJob>;
  listProvisioningJobs(input: unknown, options?: unknown): Promise<PaginatedResult<ProvisioningJob>>;
  retryProvisioning(jobId: unknown): Promise<ProvisioningJob>;
  cancelProvisioning(jobId: unknown): Promise<ProvisioningJob>;
  applyTemplate(accountId: unknown, templateId: unknown): Promise<ProvisioningJob>;
  markStepComplete(jobId: unknown, stepId: unknown): Promise<ProvisioningJob>;
}
