# Module Contract: `security_monitoring`

---

### `security_monitoring`
Security event capture, suspicious activity detection, alerting, and security case workflow.

**Functions**
```
recordSecurityEvent(event, context?) → SecurityEvent
getSecurityEvent(event_id) → SecurityEvent
listSecurityEvents(input, options?) → PaginatedResult<SecurityEvent>
createSecurityAlertRule(rule) → SecurityAlertRule
getSecurityAlertRule(rule_id) → SecurityAlertRule
listSecurityAlertRules(options?) → SecurityAlertRule[]
createSecurityCase(subject_ref, reason) → SecurityCase
getSecurityCase(case_id) → SecurityCase
resolveSecurityCase(case_id, resolution) → SecurityCase
```

**Types**
```
SecurityEvent { id, type, subject_ref?, severity, metadata?, created_at }
SecurityAlertRule { id, name, conditions, channels, enabled, created_at, updated_at }
SecurityCase { id, subject_ref, status, reason, severity, assigned_to?, created_at, resolved_at? }
SecurityCaseStatus = open | investigating | escalated | resolved | dismissed
SecurityEventType = login | password_reset | mfa_challenge | token_revoked | device_trust | suspicious_activity | policy_violation
```

**Invariants**
- Security events must be immutable once recorded.
- Alerting and case creation must be deterministic for the same event fingerprint.
- A resolved case cannot be modified except through an explicit reopen flow if supported by the deployment.

**Providers:** security event pipelines, SIEM integrations, custom auth anomaly detectors, internal trust & safety systems

---

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Security events and case state must be durably recorded before alerting.
- **Idempotency:** `recordSecurityEvent` and `createSecurityCase` must be idempotent on event or subject fingerprint.
- **Storage Model:** Durable security event log with case history and alert history.
- **Dependencies:** `auth`, `sessions`, `security_settings`, `fraud_detection`, `notifications`, `audit_log`.
- **Errors:** `SECURITY_EVENT_NOT_FOUND`, `SECURITY_CASE_NOT_FOUND`, `ALERT_RULE_INVALID`, `CASE_ALREADY_RESOLVED`, `SECURITY_EVENT_REDUNDANT`.
