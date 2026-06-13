# Saga: `data_export_gdpr`

**Version:** 0.1.0

**Modules:** right_to_erasure → data_export → storage → audit_log → notifications

---

## Steps

1. **receive_dsr(user_id, request_type, details)** → `DataSubjectRequest`
   **Compensation:** none (DSR receipt is immutable)

2. **validate_identity(user_id, verification_token)** -- Confirm requestor identity
   **Compensation:** none (read-only; failed validation = reject)

3. **collect_user_data(user_id)** -- Gather all PII across modules (profile, orders, activity)
   **Compensation:** none (read-only query)

4. **package_export(data_collection, format)** → `ExportPackage`
   **Compensation:** `storage.deleteFile(export_id)` — remove temporary export

5. **encrypt_package(export_id, user_public_key)** -- Encrypt for secure delivery
   **Compensation:** none (encryption is idempotent)

6. **deliver_export(export_id, user_email, download_url)** -- Send secure link
   **Compensation:** none (async; link expires automatically)

7. **confirm_completion(dsr_id)** -- Mark DSR as fulfilled
   **Compensation:** `right_to_erasure.reopenRequest(dsr_id, reason: "delivery_failed")`

8. **record_audit(dsr_id, "gdpr_export_completed")** -- Compliance trail
   **Compensation:** async, non-blocking

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 2 | Identity verification fails | Return `verification_failed`; allow retry within 30-day window |
| 3 | Data collection timeout | Return partial data; flag remaining sources for follow-up |
| 4 | Export exceeds size limit | Split into multiple packages; notify user of multi-part delivery |
| 5 | Encryption fails | Retry with different key; escalate if persistent |
