# Module Contract: `provisioning`

---

### `provisioning`
Account lifecycle provisioning, workspace setup, and feature activation for SaaS customers.

**Functions**
```
createProvisioningJob(account_id, template_id, requested_by, metadata?) → ProvisioningJob
getProvisioningJob(job_id) → ProvisioningJob
listProvisioningJobs(input, options?) → PaginatedResult<ProvisioningJob>
retryProvisioning(job_id) → ProvisioningJob
cancelProvisioning(job_id) → ProvisioningJob
applyTemplate(account_id, template_id) → ProvisioningJob
markStepComplete(job_id, step_id) → ProvisioningJob
```

**Types**
```
ProvisioningJob { id, account_id, template_id, status, steps_total, steps_completed, created_at, completed_at?, error_message? }
ProvisioningStep { id, key, status, started_at?, completed_at?, error_message? }
ProvisioningStatus = pending | running | paused | completed | failed | cancelled
```

**Invariants**
- Provisioning steps must execute in a declared order.
- A completed provisioning job cannot be replayed without a new job.
- Paused jobs must retain progress and resume from the last committed step.

**Providers:** internal account bootstrap flows, enterprise onboarding orchestrators, SaaS provisioning backends

---

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Step completion must be durably recorded before the next step begins.
- **Idempotency:** `createProvisioningJob`, `retryProvisioning`, and `applyTemplate` must be idempotent on job or template fingerprints.
- **Storage Model:** Durable provisioning job state and step history.
- **Dependencies:** `jobs`, `queues`, `config`, `feature_flags`, `audit_log`, `notifications`.
- **Errors:** `JOB_NOT_FOUND`, `STEP_NOT_FOUND`, `PROVISIONING_NOT_RETRYABLE`, `TEMPLATE_NOT_FOUND`, `STEP_FAILED`, `PROVISIONING_CANCELLED`.
