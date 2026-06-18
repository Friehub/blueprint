# Saga: `workspace_deletion`

**Version:** 0.1.0

**Modules:** workspaces → tenants → users → billing → data_retention

---

## Steps

1. **validate_deletion(workspace_id, requested_by)** -- Verify workspace exists, is not already deleted, and requester has owner privilege.
   **Compensation:** none (read-only; validation is idempotent)

2. **disable_workspace(workspace_id)** -- Set workspace status to disabled, reject all new incoming requests
   **Compensation:** `workspaces.enableWorkspace(workspace_id)` -- re-enables the workspace

3. **unassign_all_users(workspace_id)** -- Remove all user-tenant assignments for the workspace
   **Compensation:** `users.restoreAssignments(workspace_id, assignment_snapshot)` -- bulk-restores prior assignments

4. **cancel_active_subscriptions(tenant_id, workspace_id)** → `CancellationReceipt[]`
   **Compensation:** `billing.reinstateSubscriptions(cancellation_receipts)` -- reinstates cancelled billing plans

5. **schedule_data_retention_policy(workspace_id, retention_days)** → `RetentionJobId`
   **Compensation:** `data_retention.cancelRetentionJob(retention_job_id)` -- cancels pending deletion

6. **[async] notify_workspace_members(workspace_id, deletion_date)** -- Send email notification of pending deletion
   **Compensation:** none (informational; retry on failure)

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 2 | Concurrent request already disabling workspace | Return `already_in_progress` error |
| 3 | User unassignment partial failure (timeout) | Retry idempotently; track in dead-letter queue |
| 4 | Billing provider API unavailable | Queue cancellation; retry with backoff |
| 5 | Data retention job scheduling conflict | Reschedule during maintenance window |

---

## Invariants

- A workspace must be disabled for at least 24 hours before data is permanently deleted (grace period)
- All users must be unassigned before subscription cancellation
- Billing records for the workspace must be preserved per data retention policy (minimum 7 years)
