# Saga: `vendor_onboarding`

**Version:** 0.1.0

**Modules:** kyc → vendor_management → bank_accounts → approvals

---

## Steps

1. **collect_vendor_info(vendor_id, business_details)** -- Validate business registration, tax ID, and contact info.
   **Compensation:** none (read-only; vendor record is draft until submission)

2. **perform_kyc_check(vendor_id, documents)** → `KycResult`
   **Compensation:** `kyc.invalidateCheck(kyc_check_id)` -- expires the KYC result

3. **create_vendor_profile(vendor_id, kyc_result)** → `VendorProfile`
   **Compensation:** `vendor_management.deactivateVendor(vendor_id)` -- soft-deletes the profile

4. **link_bank_account(vendor_id, bank_details)** → `BankAccountReference`
   **Compensation:** `bank_accounts.removeAccount(vendor_id, bank_account_reference)` -- unlinks the account

5. **submit_for_approval(vendor_id)** → `ApprovalRequest`
   **Compensation:** `approvals.withdrawRequest(approval_request_id)` -- withdraws pending approval

6. **[async] notify_vendor_approved(vendor_id, email)** -- Send onboarding completion notification
   **Compensation:** `vendor_management.revertToPending(vendor_id)` -- reverts vendor to pending state

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 2 | KYC verification failed (fraud alert) | Return `kyc_failed` error; flag vendor for manual review |
| 3 | Vendor profile creation conflict (duplicate) | Merge or return `vendor_exists` error |
| 4 | Bank account validation (micro-deposit) fails | Remove bank account; retry with corrected details |
| 5 | Approval workflow rejected by compliance | Notify vendor with rejection reason; revert to draft |

---

## Invariants

- A vendor must pass KYC verification before a profile is created
- Bank account must be verified (micro-deposit or instant verification) before payouts can be enabled
- Every onboarding step must be recorded in the approval audit trail
