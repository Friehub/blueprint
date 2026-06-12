# Module Contract: `incident_management`

**Version:** 0.2.0

---

### `incident_management`
Operational incident capture, severity classification, acknowledgement tracking, automatic escalation, resolution management, and postmortem tracking. This is the canonical incident contract — see `incident_response.md` for operational procedures that reference this contract.

**Functions**
```
createIncident(input) → Incident
getIncident(incident_id) → Incident
listIncidents(input, options?) → PaginatedResult<Incident>
acknowledgeIncident(incident_id, user_id, note?) → Incident
assignIncident(incident_id, assignee_id) → Incident
updateIncidentSeverity(incident_id, severity) → Incident
escalateIncident(incident_id, reason) → Incident
addIncidentNote(incident_id, note) → IncidentNote
resolveIncident(incident_id, resolution, note?) → Incident
createRunbookLink(incident_id, url, title?) → RunbookLink
createPostmortem(incident_id, report) → Postmortem
getPostmortem(incident_id) → Postmortem?
getOnCallSchedule() → Schedule[]
```

**Types**
```
Incident { id, title, description, severity, status, service, responder?, escalated_at?, resolved_at?, duration_ms, timeline: TimelineEvent[], created_at }
IncidentNote { id, incident_id, author_id, body, created_at }
TimelineEvent { timestamp, event, actor, detail }
RunbookLink { id, incident_id, url, title?, created_at }
IncidentSeverity = sev1 | sev2 | sev3 | sev4
IncidentStatus = open | acknowledged | investigating | mitigated | resolved | closed
Resolution { status: resolved|mitigated|false_alarm|duplicate|wont_fix, notes, fix_version? }
Postmortem { id, incident_id, summary, root_cause, action_items: ActionItem[], lessons_learned, published_at }
ActionItem { description, owner, deadline, status: open|in_progress|completed }
Schedule { id, primary, secondary, start, end, escalation_path }
```

**Invariants**
- A `sev1` incident must be acknowledged within 15 minutes of creation — exceeding this without acknowledgement must trigger automatic escalation
- A `sev2` incident must be acknowledged within 30 minutes
- A `sev3` incident must be acknowledged within 1 hour
- A `sev4` incident must be acknowledged within 4 hours
- An incident that is not resolved within its severity's target resolution time must be automatically escalated to the next level:
  - sev1: 1 hour
  - sev2: 4 hours
  - sev3: 24 hours
  - sev4: 72 hours
- A postmortem must be published within 7 days of incident resolution — failing to publish within this window is a contract violation
- Every action item in a postmortem must have an assigned owner and a deadline
- Incidents must preserve an immutable timeline of state changes and notes
- Closed incidents must not be edited except by an explicit reopen flow if supported
- Duplicate incidents should be linkable but remain separate records unless merged by policy

**Providers:** PagerDuty, Opsgenie, Jira Service Management, ServiceNow, custom on-call tooling

---

## System-Level Integrations

### Consistency Model
* **Model:** `strong`
* **Details:** Incident state must be immediately consistent to prevent conflicting assignments.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for incident lifecycle events.
* **Details:** Duplicate incident reports must be deduplicated by incident context fingerprint.

### Worker Scaling
* **Policy:** Incident creation and notification are low-volume; escalation checking and postmortem reminders may be scheduled.

### Multi-Region Behavior
* **Mode:** Incidents are global; escalation paths must work across time zones.
* **Details:** On-call schedules must respect local time and holiday calendars.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Required Functions:**
  - `createIncident(input, idempotency_key?)`
  - `acknowledgeIncident(incident_id, user_id, note?, idempotency_key?)`
  - `resolveIncident(incident_id, resolution, note?, idempotency_key?)`

### Backpressure
* Incident creation is low-volume; no backpressure mechanism needed. Escalation notifications must queue if notification delivery is saturated.

### Error Taxonomy
### Module-Specific Errors
```
createIncident:
    invalid_severity:          Severity value not recognised | reject

  acknowledgeIncident:
    incident_not_found:        Incident does not exist | return 404
    incident_already_closed:   Cannot acknowledge a closed incident | reject

  escalateIncident:
    incident_not_found:        Incident does not exist | return 404
    already_escalated:         Incident already at highest escalation level | no-op

  createPostmortem:
    postmortem_exists:         Postmortem already published for this incident | return existing
    incident_not_resolved:     Cannot create postmortem for unresolved incident | reject
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createIncident       → incident.created              { incident_id, severity, summary }
acknowledgeIncident  → incident.acknowledged          { incident_id, responder, acknowledged_at }
escalateIncident     → incident.escalated             { incident_id, reason, escalated_to }
resolveIncident      → incident.resolved              { incident_id, duration_ms, resolution_status }
createPostmortem     → incident.postmortem.created    { incident_id, action_item_count }
postmortem_overdue   → incident.postmortem.overdue    { incident_id, days_since_resolution }
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

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE incidents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT,
  severity        TEXT NOT NULL CHECK (severity IN ('sev1', 'sev2', 'sev3', 'sev4')),
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'acknowledged', 'investigating', 'mitigated', 'resolved', 'closed')),
  service         TEXT,
  responder_id    UUID,
  assignee_id     UUID,
  escalation_level INT NOT NULL DEFAULT 0,
  acknowledged_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_incidents_status ON incidents(status, severity) WHERE status != 'closed';
CREATE INDEX idx_incidents_created ON incidents(created_at DESC);

CREATE TABLE incident_timeline (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id   UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  event         TEXT NOT NULL,
  actor_id      UUID,
  detail        JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_incident_timeline ON incident_timeline(incident_id, created_at);

CREATE TABLE incident_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id   UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL,
  body          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_incident_notes ON incident_notes(incident_id, created_at);

CREATE TABLE incident_runbook_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id   UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  title         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE incident_postmortems (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     UUID NOT NULL UNIQUE REFERENCES incidents(id),
  summary         TEXT NOT NULL,
  root_cause      TEXT,
  lessons_learned TEXT,
  action_items    JSONB NOT NULL DEFAULT '[]',
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE oncall_schedules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_id    UUID NOT NULL,
  secondary_id  UUID,
  start_time    TIMESTAMPTZ NOT NULL,
  end_time      TIMESTAMPTZ NOT NULL,
  escalation_path UUID[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oncall_active ON oncall_schedules(start_time, end_time);
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `incident_management.<function>`.
* **Telemetry Metrics:**
```
gensense_incident_reported_total              { severity }
gensense_incident_acknowledgement_time        histogram { severity }
gensense_incident_resolution_time             histogram { severity }
gensense_incident_escalations_total           { severity }
gensense_incident_postmortems_overdue         gauge
gensense_incident_open_total                  gauge { severity }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** notifications, audit_log, users
* **Emits To:** events
* **Recommends:** health, jobs, telemetry

### Failure Modes
| Scenario | Behavior |
|---|---|
| Notification delivery fails during escalation | Queue notification; retry with exponential backoff |
| Postmortem database write fails | Return provider_error; retry on next request |
| On-call schedule not found for escalation | Escalate to default responder defined in deployment config |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise
