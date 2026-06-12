# Operational Procedure: `incident_response`

**Version:** 0.2.0

---

> **Note:** This document has been merged into `incident_management.md` as the canonical contract. All functions, types, and invariants are now defined there. This file is retained as a reference for operational procedures and runbook guidance.

### Purpose

`incident_response` describes the operational procedures that implement the `incident_management` contract. It covers how teams respond to incidents in practice — the human processes, communication channels, and escalation paths.

### Relationship to `incident_management`

| Concern | Where defined |
|---|---|
| Incident creation, severity, acknowledgement, escalation, resolution | `incident_management.md` (contract) |
| Postmortem lifecycle, action items | `incident_management.md` (contract) |
| On-call schedule management | `incident_management.md` (contract) |
| Runbook execution during incident response | This document (procedure) |
| Communication templates during severity levels | This document (procedure) |
| Escalation phone tree and secondary contacts | This document (procedure) |

### Operational Procedures

The following procedures supplement the `incident_management` contract:

**Incident Response Runbook:**
1. **Triage** — Responder acknowledges the incident via `acknowledgeIncident`. If no acknowledgement within SLA window (sev1: 15min, sev2: 30min), auto-escalation triggers via `escalateIncident`.
2. **Investigation** — Responder adds timeline events and notes via `addIncidentNote`. Status transitions to `investigating`.
3. **Mitigation** — Responder applies mitigation and transitions status to `mitigated` via `resolveIncident` with `resolution.status = mitigated`.
4. **Resolution** — Root cause is fixed; incident transitions to `resolved` via `resolveIncident`.
5. **Postmortem** — Incident commander creates a postmortem via `createPostmortem` within 7 days.

**Communication Channels:**
- sev1: PagerDuty push + SMS + phone call to primary and secondary
- sev2: PagerDuty push + SMS to primary
- sev3: Slack/Teams notification to on-call channel
- sev4: Email to on-call group; next-business-day response

### Dependencies
- **Implements:** `incident_management` (contract)
- **Depends On:** notifications, audit_log, users, health

### Providers
PagerDuty, Opsgenie, custom runbook tooling
