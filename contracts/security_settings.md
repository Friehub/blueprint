# Module Contract: `security_settings`

**Version:** 0.1.0

---

### `security_settings`
Account security preferences such as two-factor authentication, trusted devices, recovery codes, and login alerts.

**Functions**
```
getSecuritySettings(user_id) → SecuritySettings
enableTwoFactor(user_id, method, options?) → SecuritySettings
disableTwoFactor(user_id, verification) → SecuritySettings
generateRecoveryCodes(user_id) → RecoveryCodes
revokeRecoveryCode(user_id, code) → void
listTrustedDevices(user_id, options?) → PaginatedResult<TrustedDevice>
revokeTrustedDevice(user_id, device_id) → void
setLoginAlerts(user_id, enabled) → SecuritySettings
```

**Types**
```
SecuritySettings { user_id, two_factor_enabled, two_factor_method?, login_alerts_enabled, updated_at }
TwoFactorMethod = totp | sms | email | webauthn | backup_code
RecoveryCodes { user_id, codes, generated_at, revoked_at? }
TrustedDevice { id, user_id, name, last_seen_at, created_at, revoked_at? }
```

**Invariants**
- Disabling 2FA must require a second factor or recovery path.
- Recovery codes must be single-use.
- Trusted devices may be revoked at any time and must not remain active after revocation.

**Providers:** custom auth UX, IdP preference stores, account security dashboards, WebAuthn-enabled systems

---

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Security setting changes must be strongly consistent.
- **Idempotency:** `enableTwoFactor`, `disableTwoFactor`, and `setLoginAlerts` must be idempotent on user identity and desired state.
- **Storage Model:** Durable user security preference store with device and recovery-code history.
- **Dependencies:** `auth`, `sessions`, `users`, `audit_log`, `notifications`, `encryption`.
- **Errors:** `TWO_FACTOR_ALREADY_ENABLED`, `TWO_FACTOR_NOT_ENABLED`, `VERIFICATION_FAILED`, `RECOVERY_CODE_INVALID`, `DEVICE_NOT_FOUND`, `METHOD_UNSUPPORTED`.
