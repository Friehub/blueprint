# Module Contract: `compliance_reporting`

**Version:** 0.1.0

---

### `compliance_reporting`
Automated compliance report generation with evidence mapping and export.

**Functions**
```
defineReport(template_name, framework) → ReportTemplate
generateReport(template_id, period) → ComplianceReport
getReport(report_id) → ComplianceReport
listReports(framework?) → ComplianceReport[]
mapControl(control_id, evidence_source) → ControlMapping
getEvidence(control_id, period) → EvidenceBundle
exportReport(report_id, format) → ExportResult
scheduleReport(template_id, cadence) → ScheduledReport
```

**Types**
```
ReportTemplate { id, name, framework, controls: ControlDef[], format, created_at }
ComplianceReport { id, template_id, period, status: generating|completed|failed, controls: ControlResult[], generated_at }
ControlDef { id, name, description, evidence_required }
ControlResult { control_id, status: compliant|non_compliant|not_evidenced|exempt, evidence_count, findings[] }
ControlMapping { control_id, evidence_source, query, last_validated }
EvidenceBundle { control_id, period, entries: EvidenceEntry[], completeness_pct }
EvidenceEntry { source, timestamp, value, supports_control }
ExportResult { report_id, format, destination, size_bytes, generated_at }
ScheduledReport { id, template_id, cadence, last_run_at, next_run_at }
```

**Invariants**
- A control with no evidence source mapped must be reported as `not_evidenced`, never as `compliant`
- `generateReport` must include all controls defined in the template -- omitting a control is a compliance gap
- Evidence collected outside the report period must not be included in the evidence bundle

**Providers:** custom, Drata, Vanta, SecureFrame, Sprinto

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Report templates and evidence mappings must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for report generation lifecycle events.
* **Details:** Duplicate report generation requests must return the existing report if one exists for the same period.

### Worker Scaling
* **Policy:** Report generation, evidence collection, and export must be independently scalable.

### Multi-Region Behavior
* **Mode:** Compliance reports are typically global; evidence must be collected from all regions.
* **Details:** Evidence sources in restricted regions must report their compliance status without transmitting restricted data.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* Report generation must not block new evidence collection; generate runs in background with progress tracking.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
defineReport       → compliance.report.template_created { template_id, framework }
  generateReport     → compliance.report.started           { report_id, template_id, period }
                   → compliance.report.completed          { report_id, status }
                   OR compliance.report.failed            { report_id, reason }
  exportReport       → compliance.report.exported          { report_id, format }
```

### Temporal Constraints
```
Report generation timeout:
    default:        60 minutes
    on_expiry:      mark report as failed with timeout reason

  Evidence retention:
    duration:       minimum 3 years (SOC 2 / ISO 27001 requirement)
    on_expiry:      eligible for archival after compliance audit window
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `compliance_reporting.<function>`.
* **Telemetry Metrics:**
```
gensense_compliance_reporting_reports_total           { framework, status }
  gensense_compliance_reporting_controls_total         { status }
  gensense_compliance_reporting_evidence_collected_total
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** audit_log
* **Emits To:** events
* **Recommends:** reporting, storage (for export destination), notifications
