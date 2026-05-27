# Module Contract: `auth`

---

### `auth`
Authentication -- who you are.

**Functions**
```
signUp(email, password, metadata?) → Session
signIn(email, password) → Session
signInWithProvider(provider, token) → Session
signOut(session_token) → void
refreshToken(refresh_token) → Session
verifyToken(token) → TokenClaims
requestPasswordReset(email) → void
confirmPasswordReset(token, new_password) → void
verifyEmail(token) → void
resendVerification(email) → void
```

**Types**
```
Session { access_token, refresh_token, expires_at, user_id }
TokenClaims { user_id, email, roles, expires_at, issued_at }
AuthProvider = email | google | github | apple | microsoft | phone
```

**Invariants**
- `signIn` must not return a Session for unverified accounts when verification is required
- `refreshToken` must reject expired or revoked refresh tokens
- `requestPasswordReset` must not reveal whether an email exists in the system

**Providers:** Supabase Auth, Auth0, Clerk, Firebase Auth, custom JWT

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Token validation must reflect revocation immediately

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for auth lifecycle events.
* **Details:** Duplicate sign-in or refresh retries must not create duplicate active sessions or token state.

### Worker Scaling
* **Policy:** Sign-in, token refresh, and password-reset workflows must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether auth is single-region or active/passive.
* **Details:** Revocation state must converge across regions before tokens are accepted.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If auth provider or token refresh capacity is saturated, the module must fail or defer predictably rather than creating inconsistent token state.

### Error Taxonomy
### Module-Specific Errors
```
signIn:
    invalid_credentials:       Email or password incorrect | return 401, do not reveal which
    account_not_verified:      Email verification required | prompt verification flow
    account_banned:            Account is permanently banned | return 403, do not retry
    account_suspended:         Temporary suspension | return 403 with suspension_until
    too_many_attempts:         Brute force protection triggered | return 429 with lockout_until
    provider_token_invalid:    OAuth token rejected by provider | restart OAuth flow

  refreshToken:
    token_expired:             Refresh token has passed its TTL | force re-authentication
    token_revoked:             Session was explicitly revoked | force re-authentication
    token_reuse_detected:      Refresh token used more than once (rotation violation) | revoke all sessions, force re-auth
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
signUp            → auth.user.registered      { user_id, email, provider }
  signIn            → auth.user.signed_in        { user_id, ip_address, provider }
  signOut           → auth.user.signed_out       { user_id, session_id }
  banUser           → auth.user.banned           { user_id, reason, banned_by }
  requestPasswordReset → auth.password.reset_requested { user_id, email }
```

### Temporal Constraints
```
PasswordResetToken:
    max_duration:  1 hour
    on_expiry:     token becomes invalid -- user must request new reset

  EmailVerificationToken:
    max_duration:  24 hours
    on_expiry:     token becomes invalid -- resendVerification available

  Session (access_token):
    max_duration:  15 minutes (default, configurable)
    on_expiry:     force refresh via refreshToken

  Session (refresh_token):
    max_duration:  30 days (default, configurable)
    on_expiry:     force re-authentication

  signIn lockout (too_many_attempts):
    lockout_duration: 15 minutes
    on_expiry:        reset attempt counter
```

### Storage Model
* **Model:** Durable auth state store with revocation index.
* **Details:** Sessions, tokens, and verification state must be queryable long enough to enforce revocation and abuse controls.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `auth.<function>`.
* **Telemetry Metrics:**
```
gensense_auth_signin_total                  { provider, result }
  gensense_auth_token_refresh_total           { result }
  gensense_auth_failed_attempts_total         { reason }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** sessions, users
* **Emits To:** events
* **Recommends:** audit_log, rate_limiting, notifications
