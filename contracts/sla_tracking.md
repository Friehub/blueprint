# Module Contract: `sla_tracking`

**Version:** 0.1.0

---

### `sla_tracking`
Commercial SLA definition, uptime tracking, breach calculation, and alerting.

**Functions**
```
defineSLA(name, config) → SLA
getSLA(sla_id) → SLA
listSLAs() → SLA[]
getUptime(sla_id, period) → UptimeReport
calculateBreach(sla_id, period) → BreachReport
setMaintenanceWindow(sla_id, window) → void
reportIncident(sla_id, incident) → void
getSLADashboard(sla_id?) → DashboardView
```

**Types**
```
SLA { id, name, uptime_target_pct, measurement_window, excluded_maintenance, credit_formula, created_at }
UptimeReport { sla_id, period, uptime_pct, total_minutes, available_minutes, maintenance_excluded }
BreachReport { sla_id, period, breached: bool, actual_uptime_pct, target_uptime_pct, breach_duration_min, credits_due }
MaintenanceWindow { start, end, recurring?, reason }
Incident { id, sla_id, start, end?, severity, description, resolution? }
DashboardView { sla_id, current_uptime_pct, ytd_uptime_pct, breaches_ytd: number, status: compliant|at_risk|breached }
```

**Invariants**
- Time within a declared maintenance window must be excluded from uptime calculations
- A breach must be calculated at the end of the measurement window, not before -- partial windows must not trigger breach calculations
- `reportIncident` must not modify the SLA uptime target -- it only records the incident for exclusion or root cause analysis

**Providers:** custom, Pingdom, Statuspage, Datadog SLO, New Relic SLO

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** SLA definitions and breach state must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for SLA lifecycle and breach events.
* **Details:** Duplicate incident reports must be idempotent (deduplicated by incident_id).

### Worker Scaling
* **Policy:** Uptime aggregation, breach calculation, and dashboard rendering must be independently scalable.

### Multi-Region Behavior
* **Mode:** Uptime must be tracked per-region and globally; breaches are typically global unless regional SLAs are defined.
* **Details:** A regional outage must not affect the global uptime calculation unless the global SLA specifies otherwise.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
defineSLA         → sla.created                  { sla_id, name, uptime_target }
  calculateBreach   → sla.breach.detected          { sla_id, actual, target, credits_due }
                   OR sla.breach.cleared           { sla_id, period }
  reportIncident    → sla.incident.reported        { sla_id, incident_id, severity }
```

### Temporal Constraints
```
Uptime measurement window:
    default:        30 days (rolling)
    on_expiry:      oldest data points are dropped from rolling calculation

  Maintenance window max:
    duration:       4 hours per window
    total_monthly:  8 hours max excluded per month
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `sla_tracking.<function>`.
* **Telemetry Metrics:**
```
blueprint_sla_tracking_uptime_pct                gauge { sla_id }
  blueprint_sla_tracking_breaches_total             { sla_id }
  blueprint_sla_tracking_credits_accrued             { sla_id }
```
* **SLO Targets:** This module tracks SLOs for other modules; its own SLO targets are per standards.

### Module Dependencies
* **Depends On:** health, incident_management
* **Emits To:** events, compliance_reporting (SLA evidence feeds compliance reports)
* **Recommends:** notifications, billing (for credit calculation), reporting, analytics
