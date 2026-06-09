# Module Contract: `vendor_management`

**Version:** 0.1.0

---

### `vendor_management`
Vendor lifecycle management with contract tracking, health monitoring, and offboarding.

**Functions**
```
registerVendor(name, details) → Vendor
getVendor(vendor_id) → Vendor
listVendors(status?) → Vendor[]
updateVendor(vendor_id, changes) → Vendor
recordContract(vendor_id, contract) → Contract
getContracts(vendor_id) → Contract[]
assessVendorHealth(vendor_id) → HealthAssessment
flagVendorRisk(vendor_id, risk) → void
initiateOffboarding(vendor_id, reason) → OffboardingPlan
getVendorReport(vendor_id) → VendorReport
```

**Types**
```
Vendor { id, name, category, status: active|under_review|offboarding|offboarded, risk_level, contacts, created_at }
Contract { id, vendor_id, start, end?, terms, sla_ref?, auto_renew, cost_model, created_at }
HealthAssessment { vendor_id, score, checks: HealthCheck[], last_assessed, trend: improving|stable|degrading }
HealthCheck { name, passed: bool, detail, weight }
VendorRisk { vendor_id, risk_type: security|financial|operational|compliance, severity, description, reported_at }
OffboardingPlan { vendor_id, reason, steps: OffboardingStep[], status: planning|in_progress|completed, deadline }
OffboardingStep { step, description, assigned_to, status: pending|completed, completed_at? }
VendorReport { vendor_id, name, contract_count, health_score, risk_flags, total_spend, offboarding_status? }
```

**Invariants**
- A vendor with a `critical` risk flag must not be used for new integrations until the risk is resolved
- `initiateOffboarding` must produce a plan that covers data retrieval, credential revocation, and service dependency migration
- A vendor cannot be offboarded if active contracts reference services still in production use

**Providers:** custom, Coupa, Zip, Vendr

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Vendor records and contract state must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for vendor lifecycle events.
* **Details:** Duplicate vendor registration must be idempotent (return existing vendor).

### Worker Scaling
* **Policy:** Health assessment, contract management, and offboarding are typically low-volume; no special scaling requirements.

### Multi-Region Behavior
* **Mode:** Vendor management is global; health assessments may differ by region for the same vendor.
* **Details:** Regional health data must be aggregated into the global vendor health score.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
registerVendor    → vendor.registered            { vendor_id, name, category }
  flagVendorRisk    → vendor.risk_flagged         { vendor_id, risk_type, severity }
  initiateOffboarding → vendor.offboarding.started  { vendor_id, reason }
                   → vendor.offboarding.completed { vendor_id }
```

### Temporal Constraints
```
Health assessment interval:
    default:        30 days
    on_expiry:      health score is stale; next assessment due

  Contract expiry alert:
    ahead:          60 days before contract end
    on_expiry:      notify vendor manager
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `vendor_management.<function>`.
* **Telemetry Metrics:**
```
gensense_vendor_management_vendors_total         { status }
  gensense_vendor_management_risks_active          { severity }
  gensense_vendor_management_health_scores          gauge
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events
* **Recommends:** procurement, notifications, reporting
