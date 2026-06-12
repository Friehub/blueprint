# Module Contract: `incident_response`

**Version:** 0.1.0

---

### `incident_response`
Incident lifecycle management with severity classification, escalation, and postmortem tracking.

**Functions**
```
reportIncident(severity, summary, context) → Incident
getIncident(incident_id) → Incident
updateIncident(incident_id, changes) → Incident
acknowledgeIncident(incident_id, responder) → void
resolveIncident(incident_id, resolution) → void
escalateIncident(incident_id, reason) → void
createPostmortem(incident_id, report) → Postmortem
getPostmortem(incident_id) → Postmortem?
getOnCallSchedule() → Schedule[]
```

**Types**
```
Incident { id, severity: sev1|sev2|sev3|sev4, summary, status, responder?, escalated_at?, resolved_at?, duration_ms, timeline: TimelineEvent[] }
TimelineEvent { timestamp, event, actor, detail }
Resolution { status: resolved|mitigated|false_alarm, notes, fix_version? }
Postmortem { id, incident_id, summary, root_cause, action_items: ActionItem[], lessons_learned, published_at }
ActionItem { description, owner, deadline, status: open|in_progress|completed }
Schedule { id, primary, secondary, start, end, escalation_path }
Severity = sev1 | sev2 | sev3 | sev4
```

**Invariants**
- A `sev1` incident must be acknowledged within 15 minutes of reporting -- exceeding this without acknowledgement must trigger automatic escalation
- A `sev2` incident must be acknowledged within 30 minutes
- An incident that is not resolved within its severity's target resolution time must be automatically escalated to the next level
- A postmortem must be published within 7 days of incident resolution -- failing to publish within this window is a contract violation
- Every action item in a postmortem must have an assigned owner and a deadline

**Providers:** PagerDuty, Opsgenie, custom

**Dependencies:** notifications, audit_log

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Incident state must be immediately consistent to prevent conflicting assignments

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for incident lifecycle events.
* **Details:** Duplicate incident reports must be deduplicated by incident context fingerprint.

### Worker Scaling
* **Policy:** Incident creation and notification are low-volume; escalation checking may be scheduled.

### Multi-Region Behavior
* **Mode:** Incidents are global; escalation paths must work across time zones.
* **Details:** On-call schedules must respect local time and holiday calendars.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
reportIncident       -> incident.reported          { incident_id, severity, summary }
  acknowledgeIncident  -> incident.acknowledged       { incident_id, responder }
  resolveIncident      -> incident.resolved           { incident_id, duration_ms }
  escalateIncident     -> incident.escalated          { incident_id, reason }
  createPostmortem     -> incident.postmortem.created { incident_id }
```

### Temporal Constraints
```
Acknowledgement windows:
    sev1:           15 minutes
    sev2:           30 minutes
    sev3:           1 hour
    sev4:           4 hours
    on_expiry:      auto-escalate to next level

  Resolution targets:
    sev1:           1 hour
    sev2:           4 hours
    sev3:           24 hours
    sev4:           72 hours
    on_expiry:      flag for review; auto-escalate if not mitigated

  Postmortem deadline:
    default:        7 days after resolution
    on_expiry:      notify incident commander; flag as overdue
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `incident_response.<function>`.
* **Telemetry Metrics:**
```
gensense_incident_response_reported_total       { severity }
  gensense_incident_response_acknowledgement_time   histogram { severity }
  gensense_incident_response_resolution_time         histogram { severity }
  gensense_incident_response_postmortems_overdue
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** notifications, audit_log
* **Emits To:** events
* **Recommends:** reporting, telemetry
