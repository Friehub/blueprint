# Saga: `secret_rotation`

**Version:** 0.1.0

**Modules:** secrets → jobs → audit_log → notifications

---

## Steps

1. **validate_secret(secret_id, namespace)** -- Confirm secret exists, is rotatable, and rotation is not already in progress.
   **Compensation:** none (read-only; status check is idempotent)

2. **generate_new_secret_value(secret_id)** → `SecretPayload`
   **Compensation:** `secrets.discardDraft(secret_id, draft_version)` -- removes the generated draft

3. **store_new_version(secret_id, secret_payload)** → `SecretVersionReference`
   **Compensation:** `secrets.rollbackVersion(secret_id, previous_version)` -- restores previous active version

4. **schedule_dependent_job_update(secret_id, new_version)** → `JobBatchId`
   **Compensation:** `jobs.cancelBatch(job_batch_id)` -- cancels all queued dependent job updates

5. **activate_new_version(secret_id, new_version)** -- Promote new version to active, expire old version
   **Compensation:** `secrets.reactivateVersion(secret_id, previous_version)` -- switches active version back

6. **[async] notify_rotation_complete(secret_id, rotated_by)** -- Send confirmation to security team
   **Compensation:** none (informational; retry on failure)

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 2 | Entropy source unavailable | Retry with fallback CSPRNG; alert operator |
| 3 | Secret store write conflict | Retry with optimistic locking; escalate if persistent |
| 4 | Job scheduling backlog exceeds threshold | Cancel batch; reschedule during off-peak window |
| 5 | Active version promotion fails | Keep current version active; alert security team |

---

## Invariants

- At most one active version of a secret at any time
- The previous secret version must remain decryptable for at least one rotation cycle (grace period)
- All secret rotation attempts (success and failure) must be recorded in the audit log
