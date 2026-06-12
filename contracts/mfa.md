# Module Contract: `mfa`

**Version:** 0.1.0

---

### `mfa`
Multi-factor authentication methods: TOTP, SMS/email OTP, hardware security keys (FIDO2/WebAuthn), and backup codes. Used by `auth` as a second factor after first-factor authentication.

**Functions**
```
setupTotp(user_id) → TotpSetup
verifyTotp(user_id, code) → boolean
setupSmsOtp(phone) → void
sendSmsOtp(phone) → void
verifySmsOtp(phone, code) → boolean
setupEmailOtp(email) → void
sendEmailOtp(email) → void
verifyEmailOtp(email, code) → boolean
setupFido2(user_id, challenge) → Fido2Registration
verifyFido2(user_id, credential_id, assertion) → boolean
generateBackupCodes(user_id) → BackupCode[]
verifyBackupCode(user_id, code) → boolean
getMFAStatus(user_id) → MFAStatus
disableMFA(user_id, method) → void
disableAllMFA(user_id) → void
listMFAMethods(user_id) → MFAMethod[]
```

**Types**
```
TotpSetup { secret, qr_code_url, recovery_codes?, created_at }
Fido2Registration { challenge, rp_info, user_info, pubkey_cred_params }
BackupCode { id, code_hash, used, used_at? }
MFAStatus { methods: MFAMethod[], enabled, required, last_verified_at? }
MFAMethod = totp | sms_otp | email_otp | fido2 | backup_code
SmsOtpState { phone, code_hash, expires_at, attempt_count, locked_until? }
EmailOtpState { email, code_hash, expires_at, attempt_count, locked_until? }
```

**Invariants**
- All verification functions are rate-limited to 5 attempts per 15-minute rolling window per method per identity. Exceeding this returns `rate_limited` with `retry_after`.
- Backup codes are single-use: `verifyBackupCode` must mark the code as `used` atomically. Reusing the same code returns `false`.
- At most 10 backup codes may be active per user. Generating new codes invalidates the previous set.
- TOTP secrets must be encrypted at rest; the raw secret must never appear in logs, metrics, or API responses after setup.
- FIDO2 credentials are bound to the relying party origin; credential verification must reject assertions from a different origin.
- An OTP code expires 5 minutes after issuance; expired codes return `false` regardless of value.
- When a user has one or more MFA methods enabled, `auth.signIn` must return a `partial` session after first-factor success. A full session must not be issued until any enabled MFA method is verified.

**Providers:** Authy, Twilio Verify, Duo Security, FIDO2/WebAuthn, custom TOTP

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** MFA enable/disable must take effect immediately for the next authentication attempt.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for MFA lifecycle events.
* **Details:** Duplicate OTP send requests must not invalidate the previous OTP (idempotent send is a no-op).

### Worker Scaling
* **Policy:** OTP send and verification are low-latency; no special scaling required. FIDO2 verification is stateless.

### Multi-Region Behavior
* **Mode:** MFA state must be replicated across regions; a user verified in one region must be trusted in all regions for the session duration.
* **Details:** Backup code usage must converge before a code can be reused across regions.

### Idempotency Requirements
* **Standard:** All state-mutating functions accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Required Functions:**
  - `setupTotp(user_id, idempotency_key?)`
  - `generateBackupCodes(user_id, idempotency_key?)`

### Backpressure
* If OTP delivery provider is rate-limited, OTP send requests must defer or fail closed (do not bypass MFA).

### Error Taxonomy
### Module-Specific Errors
```
verifyTotp:
    totp_not_setup:          User has no TOTP secret configured | prompt setup
    invalid_code:            Code does not match current TOTP value | return false
    too_many_attempts:       Rate limit exceeded | return rate_limited with retry_after

  verifyBackupCode:
    code_already_used:       Backup code already consumed | return false
    no_codes_remaining:      All backup codes used | prompt regeneration
    invalid_code:            Code does not match any backup code hash | return false

  setupFido2:
    credential_exists:       Credential ID already registered to this user | return existing
    unsupported_platform:    Client does not support WebAuthn | return error
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
setupTotp            → mfa.totp.setup                  { user_id }
verifyTotp           → mfa.totp.verified               { user_id, result }
sendSmsOtp           → mfa.sms_otp.sent                { phone }
verifySmsOtp         → mfa.sms_otp.verified            { user_id, phone, result }
setupFido2           → mfa.fido2.setup                 { user_id, credential_id }
verifyFido2          → mfa.fido2.verified              { user_id, credential_id, result }
generateBackupCodes  → mfa.backup_codes.generated      { user_id, count }
verifyBackupCode     → mfa.backup_code.used            { user_id, remaining }
disableMFA           → mfa.method.disabled             { user_id, method }
disableAllMFA        → mfa.all_disabled                { user_id }
```

### Temporal Constraints
```
OTP code expiry:
    max_duration:   5 minutes
    on_expiry:      code becomes invalid; user must request new OTP

  TOTP drift tolerance:
    window:         -1 to +1 (30-second steps)
    on_drift:       accept code if within window; reject outside

  Rate limit window:
    duration:       15 minutes rolling
    max_attempts:   5 per method per identity
    lockout:        15 minutes escalating (see global brute force protection)
```

### Database Schema

#### PostgreSQL
```sql
CREATE TYPE mfa_method AS ENUM ('totp', 'sms_otp', 'email_otp', 'fido2', 'backup_code');

CREATE TABLE mfa_methods (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  method        mfa_method NOT NULL,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_at   TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_mfa_methods_user ON mfa_methods(user_id, method);

CREATE TABLE mfa_totp_secrets (
  user_id       UUID PRIMARY KEY REFERENCES mfa_methods(id),
  encrypted_secret TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE mfa_backup_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  code_hash     TEXT NOT NULL,
  used          BOOLEAN NOT NULL DEFAULT false,
  used_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mfa_backup_codes_user ON mfa_backup_codes(user_id, used);

CREATE TABLE mfa_fido2_credentials (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL,
  credential_id     TEXT NOT NULL,
  public_key        TEXT NOT NULL,
  sign_count        BIGINT NOT NULL DEFAULT 0,
  device_name       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_mfa_fido2_credential ON mfa_fido2_credentials(credential_id);
CREATE INDEX idx_mfa_fido2_user ON mfa_fido2_credentials(user_id);

CREATE TABLE mfa_rate_limits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity      TEXT NOT NULL,
  method        mfa_method NOT NULL,
  attempt_count INT NOT NULL DEFAULT 0,
  window_start  TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until  TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_mfa_rate_limits ON mfa_rate_limits(identity, method);
```

### Redis (OTP Code Cache)
```
OTP Code:
  Key:    mfa_otp:{method}:{identifier}
  Value:  { code_hash, expires_at, attempt_count }
  TTL:    5 minutes

Rate Limit Counter:
  Key:    mfa_ratelimit:{method}:{identity}
  Value:  attempt_count
  TTL:    15 minutes (rolling)
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `mfa.<function>`.
* **Telemetry Metrics:**
```
blueprint_mfa_verification_total              { method, result: success|failure }
blueprint_mfa_backup_code_usage_total         { result: valid|used|exhausted }
blueprint_mfa_method_setup_total              { method }
blueprint_mfa_rate_limit_hits_total           { method }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** users, notifications (for OTP delivery)
* **Emits To:** events
* **Recommends:** rate_limiting, audit_log, encryption (for secret storage)

### Failure Modes
| Scenario | Behavior |
|---|---|
| OTP delivery provider unreachable | Return provider_error; do not bypass MFA |
| FIDO2 client unsupported | Fall back to TOTP or OTP method |
| Rate limit exceeded | Return rate_limited with retry_after; do not reveal valid/invalid status |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise
