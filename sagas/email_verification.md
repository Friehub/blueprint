# Saga: `email_verification`

**Version:** 0.1.0

**Modules:** auth → emails → users → onboarding

---

## Steps

1. **create_user(email, name, password)** → `User`
   **Compensation:** `users.softDeleteUser(user_id)` -- marks user as deleted, preserves referential integrity

2. **generate_verification_token(user_id, email)** → `VerificationToken`
   **Compensation:** `auth.invalidateVerificationToken(token_id)` -- revokes unused token

3. **send_verification_email(email, token, user_id)** -- Dispatch verification link
   **Compensation:** `emails.cancelNotification(email_id)` -- best-effort recall

4. **verify_token(token, user_id)** → `VerifiedClaim`
   **Compensation:** none (idempotent -- subsequent verifications return same result)

5. **mark_email_verified(user_id)** -- Set `email_verified_at` timestamp on user record
   **Compensation:** `users.unverifyEmail(user_id)` -- reverts verification status

6. **[async] trigger_onboarding(user_id)** -- Enqueue welcome flow (welcome email, tutorial flags, default preferences)
   **Compensation:** none (onboarding is idempotent; re-triggerable via admin)

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 1 | Email already registered | Return `email_taken` error; no state change |
| 3 | Email provider down | Retry with backoff; token remains valid |
| 5 | DB write failure | Retry idempotently; token still valid |
| 6 | Onboarding queue full | Events queued in outbox; retry on next cron tick |

---

## Invariants

- A user must not be able to access restricted resources before email is verified
- Verification token must expire after TTL (default 24 hours) and be single-use
- Deleting an unverified user must cascade to their verification token and onboarding state
