# Saga: `data_pipeline_failure_recovery`

**Version:** 0.1.0

**Modules:** data_pipeline → outbox_processor → jobs → notifications

---

## Steps

1. **detect_failure(pipeline_run_id, error_context)** -- Identify failed pipeline stage and capture checkpoint metadata.
   **Compensation:** none (read-only; detection is idempotent)

2. **snapshot_failed_state(pipeline_run_id, checkpoint)** → `StateSnapshotReference`
   **Compensation:** `data_pipeline.deleteSnapshot(snapshot_reference)` -- cleans up orphaned snapshot

3. **rollback_partial_writes(pipeline_run_id)** -- Apply inverse operations for any partial stage outputs
   **Compensation:** none (idempotent; rollback is safe to re-apply)

4. **replay_outbox_messages(pipeline_run_id)** -- Reprocess any outbox events that were queued before the failure
   **Compensation:** `outbox_processor.deduplicateMessages(message_ids)` -- marks replayed messages as processed

5. **resume_pipeline(pipeline_run_id, snapshot_reference)** → `PipelineRecoveryReceipt`
   **Compensation:** `data_pipeline.haltRecovery(pipeline_run_id)` -- pauses recovery to allow manual inspection

6. **[async] notify_operators(pipeline_run_id, recovery_status)** -- Alert data engineering team of recovery outcome
   **Compensation:** none (informational; retry on failure)

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 1 | Pipeline run ID not found in job store | Return `invalid_run` error; no state change |
| 3 | Rollback conflicts with concurrent pipeline | Queue manual reconciliation; alert operator |
| 4 | Outbox messages missing or corrupted | Rebuild from source-of-truth snapshots |
| 5 | Pipeline resume fails due to schema drift | Halt recovery; require manual intervention |

---

## Invariants

- A failed pipeline run must never leave partial writes in the target data store
- Outbox messages must be exactly-once delivered after recovery
- Recovery must complete within the pipeline SLA (default 5 minutes)
