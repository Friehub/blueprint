# Saga: `scheduled_report_delivery`

**Version:** 0.1.0

**Modules:** reporting → scheduled_tasks → emails → storage

---

## Steps

1. **validate_schedule(schedule_id, tenant_id)** -- Verify schedule is active, report configuration exists, and recipient list is valid.
   **Compensation:** none (read-only; validation is idempotent)

2. **generate_report(report_config_id, parameters)** → `ReportDocument`
   **Compensation:** `reporting.discardDraft(report_document_id)` -- deletes the generated report draft

3. **encrypt_report(report_document, encryption_key_id)** → `EncryptedPayload`
   **Compensation:** `storage.deleteEncryptedPayload(encrypted_payload_id)` -- removes encrypted artifact

4. **upload_to_storage(encrypted_payload, storage_path)** → `StorageReference`
   **Compensation:** `storage.deleteObject(storage_reference)` -- removes uploaded file

5. **generate_signed_url(storage_reference, expiry)** → `SignedUrl`
   **Compensation:** `storage.revokeSignedUrl(signed_url_id)` -- invalidates the URL immediately

6. **send_report_email(recipients, signed_url, schedule_id)** → `EmailDeliveryId`
   **Compensation:** `emails.cancelDelivery(email_delivery_id)` -- best-effort recall of queued email

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 1 | Schedule not found or disabled | Return `invalid_schedule` error; no state change |
| 2 | Report generation timeout for large dataset | Split into chunks; retry with smaller window |
| 4 | Storage quota exceeded or write failure | Retry with compression; alert billing team |
| 6 | Email provider rate-limited | Queue for retry with exponential backoff |

---

## Invariants

- Generated reports must be encrypted at rest before storage upload
- Signed URLs must expire within 7 days of generation (default 24 hours)
- Every report delivery must be logged with delivery status for compliance auditing
