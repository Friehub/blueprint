# Saga: `password_reset`

**Version:** 0.1.0

**Modules:** auth → sessions → emails → audit_log

---

## Steps

1. **validate_email(email)** -- Check user exists and account is active. Rate-limit check.
   **Compensation:** none (read-only, rate-limit counter expires naturally)

2. **generate_token(user_id)** → `ResetToken`
   **Compensation:** `auth.invalidateResetToken(token_id)` -- revokes unused token

3. **send_reset_email(email, token, user_id)** -- Dispatch reset link via email provider
   **Compensation:** `emails.cancelNotification(email_id)` -- best-effort recall

4. **verify_token(token, user_id)** → `VerifiedClaim`
   **Compensation:** none (idempotent -- verify returns the same result)

5. **update_password(user_id, new_hash)** -- Replace stored password hash
   **Compensation:** `auth.restorePreviousHash(user_id, previous_hash)` -- reverts to old hash

6. **[async] invalidate_sessions(user_id)** -- Revoke all active sessions except current
   **Compensation:** none (security measure -- re-login is expected)

7. **[async] notify_success(email, user_id)** -- Send confirmation email
   **Compensation:** none (informational only; retry on failure)

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 1 | Email not found or account locked | Return `invalid_email` error; no state change |
| 3 | Email provider unreachable | Retry with backoff; invalidate token after N failures |
| 5 | DB write failure | Retry idempotently; token still valid |
| 6 | Session invalidation partial | Invalidate remaining sessions on next request |

---

## Invariants

- A reset token must be single-use and expire after TTL (default 15 minutes)
- Password hash must never be stored in plaintext or logs
- All password reset attempts must be recorded in the audit log
- Session invalidation must precede notifying the user of success
