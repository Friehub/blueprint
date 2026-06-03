# Module Contract: `incident_management`

**Version:** 0.1.0

---

### `incident_management`
Operational incident capture, severity management, acknowledgements, escalation, and resolution tracking.

**Functions**
```
createIncident(input) → Incident
getIncident(incident_id) → Incident
listIncidents(input, options?) → PaginatedResult<Incident>
acknowledgeIncident(incident_id, user_id, note?) → Incident
assignIncident(incident_id, assignee_id) → Incident
updateIncidentSeverity(incident_id, severity) → Incident
addIncidentNote(incident_id, note) → IncidentNote
resolveIncident(incident_id, resolution, note?) → Incident
createRunbookLink(incident_id, url, title?) → RunbookLink
```

**Types**
```
Incident { id, title, description, severity, status, service, created_at, acknowledged_at?, resolved_at?, closed_at? }
IncidentNote { id, incident_id, author_id, body, created_at }
RunbookLink { id, incident_id, url, title?, created_at }
IncidentSeverity = sev1 | sev2 | sev3 | sev4
IncidentStatus = open | acknowledged | investigating | mitigated | resolved | closed
Resolution = fixed | monitoring | duplicate | false_alarm | wont_fix
```

**Invariants**
- Incidents must preserve an immutable timeline of state changes and notes.
- Closed incidents must not be edited except by an explicit reopen flow if supported.
- Duplicate incidents should be linkable but remain separate records unless merged by policy.

**Providers:** PagerDuty, Opsgenie, Jira Service Management, ServiceNow, custom on-call tooling

---

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Incident status transitions must be durably recorded before notifications or escalations are dispatched.
- **Idempotency:** `createIncident`, `acknowledgeIncident`, and `resolveIncident` must be idempotent on incident identity.
- **Storage Model:** Durable incident timeline store with notes and runbook history.
- **Dependencies:** `notifications`, `audit_log`, `jobs`, `health`, `users`.
- **Errors:** `INCIDENT_NOT_FOUND`, `INCIDENT_ALREADY_CLOSED`, `INVALID_SEVERITY`, `ACKNOWLEDGEMENT_NOT_ALLOWED`, `RESOLUTION_INVALID`.
