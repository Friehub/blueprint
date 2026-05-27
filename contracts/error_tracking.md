# Module Contract: `error_tracking`

---

### `error_tracking`
Application error capture, issue grouping, deduplication, triage, and alert routing.

**Functions**
```
recordError(error, context?) → ErrorEvent
getErrorEvent(event_id) → ErrorEvent
listErrorEvents(input, options?) → PaginatedResult<ErrorEvent>
getIssue(issue_id) → ErrorIssue
listIssues(input, options?) → PaginatedResult<ErrorIssue>
updateIssue(issue_id, data) → ErrorIssue
assignIssue(issue_id, assignee_id) → ErrorIssue
muteIssue(issue_id, reason?) → ErrorIssue
unmuteIssue(issue_id) → ErrorIssue
createAlertRule(rule) → AlertRule
getAlertRule(rule_id) → AlertRule
listAlertRules(options?) → AlertRule[]
```

**Types**
```
ErrorEvent { id, fingerprint, message, severity, stacktrace?, context?, issue_id?, created_at }
ErrorIssue { id, fingerprint, title, status, severity, event_count, assignee_id?, first_seen_at, last_seen_at, created_at, updated_at }
AlertRule { id, name, conditions, channels, enabled, created_at, updated_at }
Severity = debug | info | warning | error | critical
IssueStatus = open | muted | assigned | resolved | ignored
```

**Invariants**
- Similar errors must collapse into a stable issue fingerprint.
- Sensitive data must be redacted before persistence.
- Recording an error must not crash the caller.

**Providers:** Sentry, Rollbar, Bugsnag, Honeybadger, custom crash/error aggregation pipelines

---

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Error ingestion must be durable before alerting or grouping is exposed.
- **Idempotency:** `recordError` must be idempotent on fingerprint + event identity where possible.
- **Storage Model:** Durable error event store with issue grouping and alert history.
- **Dependencies:** `notifications`, `audit_log`, `storage`, `jobs`, `users`.
- **Errors:** `ERROR_EVENT_NOT_FOUND`, `ISSUE_NOT_FOUND`, `ALERT_RULE_INVALID`, `ISSUE_MUTED`, `ALERT_DELIVERY_FAILED`.
