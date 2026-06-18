# Saga: `content_moderation_review`

**Version:** 0.1.0

**Modules:** moderation → content_safety → notifications → audit_log

---

## Steps

1. **submit_content(content_id, source, content_type)** -- Register content item for moderation review pipeline.
   **Compensation:** `moderation.withdrawSubmission(content_id)` -- removes the content from review queue

2. **run_automated_scan(content_id, content_data)** → `ScanResult`
   **Compensation:** `content_safety.clearScanResult(content_id)` -- marks scan as inconclusive (triggers human review)

3. **apply_auto_action(scan_result, content_id)** -- Auto-approve, auto-reject, or flag for human review based on confidence
   **Compensation:** `moderation.reverseAutoAction(content_id, previous_status)` -- reverts to pre-scan state

4. **escalate_to_human(content_id, scan_result)** → `HumanReviewTicket`
   **Compensation:** `moderation.closeReviewTicket(human_review_ticket_id)` -- closes the ticket without action

5. **apply_human_decision(human_review_ticket_id, decision)** -- Approve, reject, or edit content based on reviewer input
   **Compensation:** `moderation.revertDecision(content_id, previous_final_status)` -- restores content to last known good state

6. **[async] notify_submitter(content_id, decision, reason)** -- Send moderation outcome to content owner
   **Compensation:** none (informational; retry on failure)

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 2 | Automated scan service returns error | Retry with backoff; flag for manual review after 3 failures |
| 3 | Confidence score below auto-action threshold | Auto-escalate to human review queue |
| 5 | Human reviewer takes longer than SLA | Escalate to senior reviewer; notify moderation manager |
| 6 | Notification delivery fails | Content status visible in dashboard; email queued for retry |

---

## Invariants

- All content must pass automated scan before being publicly visible
- A human reviewer must review all content flagged with confidence below the threshold
- Every moderation action (auto or manual) must be recorded in the audit log with reason code
