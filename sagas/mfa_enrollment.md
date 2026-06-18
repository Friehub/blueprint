# Saga: `mfa_enrollment`

**Version:** 0.1.0

**Modules:** mfa → users → auth → notifications

---

## Steps

1. **initiate_enrollment(user_id, method)** → `EnrollmentSession` -- Begin TOTP or SMS enrollment, rate-limit check
   **Compensation:** `mfa.cancelEnrollment(session_id)` -- discards incomplete session

2. **generate_secret(session_id, method)** → `MfaSecret` -- Generate shared secret or phone challenge
   **Compensation:** none (secret held in session; cleaned up on cancel)

3. **verify_first_code(session_id, code)** → `VerifiedChallenge`
   **Compensation:** none (idempotent -- code verification returns same result)

4. **generate_backup_codes(user_id)** → `BackupCode[]`
   **Compensation:** `mfa.regenerateBackupCodes(user_id)` -- invalidates generated codes

5. **confirm_enrollment(user_id, method, secret)** -- Persist MFA method and encrypted secret
   **Compensation:** `mfa.disableMfa(user_id, method)` -- removes enrolled method

6. **[async] notify_enrolled(user_id, method)** -- Send confirmation email/SMS
   **Compensation:** none (informational only; retry on failure)

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 1 | Rate limit exceeded | Return `too_many_attempts`; no state change |
| 3 | Invalid code | Increment attempt counter; return `invalid_code` |
| 5 | DB write failure | Retry idempotently; enrollment session still open |
| 6 | Notification channel unavailable | Log and defer; enrollment already confirmed |

---

## Invariants

- Backup codes must be hashed before storage and regenerated on every new enrollment
- An MFA method must be verified (step 3) before it can be activated (step 5)
- Users must retain at least one active authentication method at all times
