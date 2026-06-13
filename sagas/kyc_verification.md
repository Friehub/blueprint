# Saga: `kyc_verification`

**Version:** 0.1.0

**Modules:** kyc → fraud_detection → users → notifications → audit_log

---

## Steps

1. **collect_documents(user_id, doc_type, files)** → `VerificationRequest`
   **Compensation:** none (draft state, auto-expires in 48h)

2. **validate_documents(request_id)** -- Check document authenticity, expiry, format
   **Compensation:** none (read-only validation)

3. **run_aml_screening(user_id, name, country)** → `ScreeningResult`
   **Compensation:** none (read-only, results cached 24h)

4. **assess_risk(user_id, signals)** → `RiskScore`
   **Compensation:** none (read-only)

5. **approve_verification(request_id)** → `VerifiedUser`
   **Compensation:** `kyc.revertVerification(request_id, reason: "saga_rollback")` — reverts KYC status

6. **update_user_status(user_id, "verified")** -- Mark user as KYC-approved
   **Compensation:** `users.updateUser(user_id, { status: "pending_verification" })`

7. **[async] notify_user(user_id, "verification_complete")** -- Send success notification
   **Compensation:** async, non-blocking

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 2 | Document forged or expired | Return `document_invalid` error; prompt resubmission |
| 3 | AML screening flagged | Escalate to manual review; do NOT auto-approve |
| 4 | Risk score exceeds threshold | Return `manual_review_required`; route to compliance team |
| 5 | Approval write fails | Retry with idempotency key; no compensation needed |
