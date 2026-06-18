# Saga: `incident_declaration`

**Version:** 0.1.0

**Modules:** incident_management → notifications → audit_log → sla_tracking

---

## Steps

1. **validate_alert(alert_id, source)** -- Deduplicate alert, check severity, and verify escalation policy exists.
   **Compensation:** none (read-only; dedup check is idempotent)

2. **create_incident_record(alert_id, severity, title)** → `IncidentId`
   **Compensation:** `incident_management.deleteIncident(incident_id)` -- removes the incident (admin only)

3. **assign_responder(incident_id, on_call_schedule)** → `ResponderAssignment`
   **Compensation:** `incident_management.unassignResponder(assignment_id)` -- reassigns to next on-call

4. **pager_incident(incident_id, responder_id)** -- Page primary and secondary responders via escalation policy
   **Compensation:** `notifications.acknowledgePage(incident_id)` -- marks page as acknowledged to stop escalation

5. **start_sla_timer(incident_id, severity)** → `SlaTimerId`
   **Compensation:** `sla_tracking.pauseTimer(sla_timer_id)` -- pauses SLA clock (if acknowledged)

6. **[async] notify_stakeholders(incident_id, severity, channel)** -- Send incident notification to status page and comms channel
   **Compensation:** none (informational; retry on failure)

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 2 | Concurrent incident creation for same alert | Merge duplicate incidents; keep original |
| 3 | On-call schedule empty or stale | Fall back to manual assignment; alert ops lead |
| 4 | Pager provider unreachable | Retry with SMS fallback; escalate after N failures |
| 5 | SLA timer DB write contention | Use optimistic clock; approximate start time |

---

## Invariants

- Each unique alert must map to exactly one incident (dedup enforced)
- SLA timer must start within 30 seconds of incident creation
- Every incident state change must be recorded in the audit log with actor and timestamp
