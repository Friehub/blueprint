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

### Invariants
- `registerVendor` with the same vendor `name` must return the existing vendor record — duplicate registration is idempotent
- A vendor with a `security` risk of `critical` severity must have its status set to `under_review` automatically
- `initiateOffboarding` must fail with `VENDOR_HAS_ACTIVE_CONTRACTS` if any active contract references services still in production use
- Health assessment scores must be between 0 and 100 inclusive — scores outside this range must be rejected
- A vendor whose `status` is `offboarded` must not accept any state-mutating operations

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
* **Required Functions:** `registerVendor`, `flagVendorRisk`, `initiateOffboarding`

### Error Taxonomy
### Module-Specific Errors
```
registerVendor:
    vendor_already_exists:   Vendor with this name already exists | return existing

  flagVendorRisk:
    risk_already_flagged:    Risk already reported for this vendor/type | update existing
    vendor_offboarded:       Cannot flag risk for an offboarded vendor

  initiateOffboarding:
    vendor_has_active_contracts:  Vendor has active contracts | resolve contracts first
    vendor_already_offboarding:   Vendor offboarding is already in progress
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
registerVendor       → vendor.registered            { vendor_id, name, category }
flagVendorRisk       → vendor.risk_flagged           { vendor_id, risk_type, severity }
initiateOffboarding  → vendor.offboarding.started    { vendor_id, reason }
                   → vendor.offboarding.completed   { vendor_id }
assessVendorHealth   → vendor.health.assessed        { vendor_id, score, trend }
```

### Temporal Constraints
```
Health assessment interval:
    default:        30 days
    on_expiry:      health score is stale; next assessment due

  Contract expiry alert:
    ahead:          60 days before contract end
    on_expiry:      notify vendor manager

  Offboarding deadline:
    default:        90 days
    on_expiry:      escalate to procurement lead
```

### Storage Model
* **Model:** Durable vendor and contract store.

```sql
CREATE TABLE vendors (
    id              UUID PRIMARY KEY,
    name            VARCHAR(255) NOT NULL UNIQUE,
    category        VARCHAR(100),
    status          VARCHAR(50) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'under_review', 'offboarding', 'offboarded')),
    risk_level      VARCHAR(50) DEFAULT 'low',
    contacts        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vendor_contracts (
    id              UUID PRIMARY KEY,
    vendor_id       UUID NOT NULL REFERENCES vendors(id),
    start_date      DATE NOT NULL,
    end_date        DATE,
    terms           TEXT,
    sla_ref         VARCHAR(255),
    auto_renew      BOOLEAN NOT NULL DEFAULT false,
    cost_model      JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vendor_health_assessments (
    id              UUID PRIMARY KEY,
    vendor_id       UUID NOT NULL REFERENCES vendors(id),
    score           INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    trend           VARCHAR(50) NOT NULL DEFAULT 'stable'
                    CHECK (trend IN ('improving', 'stable', 'degrading')),
    checks          JSONB NOT NULL,
    assessed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vendor_risks (
    id              UUID PRIMARY KEY,
    vendor_id       UUID NOT NULL REFERENCES vendors(id),
    risk_type       VARCHAR(50) NOT NULL CHECK (risk_type IN ('security', 'financial', 'operational', 'compliance')),
    severity        VARCHAR(50) NOT NULL,
    description     TEXT,
    reported_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vendor_offboarding_plans (
    id              UUID PRIMARY KEY,
    vendor_id       UUID NOT NULL REFERENCES vendors(id),
    reason          TEXT NOT NULL,
    status          VARCHAR(50) NOT NULL DEFAULT 'planning'
                    CHECK (status IN ('planning', 'in_progress', 'completed')),
    steps           JSONB NOT NULL,
    deadline        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vendor_contracts_vendor ON vendor_contracts(vendor_id);
CREATE INDEX idx_vendor_risks_vendor ON vendor_risks(vendor_id);
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `vendor_management.<function>`.
* **Telemetry Metrics:**
```
gensense_vendor_management_operation_total         counter { function, result: success|failure }
gensense_vendor_management_operation_duration_ms   histogram { function, p50, p95, p99 }
gensense_vendor_management_errors_total            counter { function, error_code }
gensense_vendor_management_vendors_total           gauge { status }
gensense_vendor_management_risks_active            gauge { severity }
gensense_vendor_management_health_scores           gauge
gensense_vendor_management_offboardings_total      counter { status }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return ProviderError, do not retry indefinitely |
| Health assessment provider unavailable | Return previous health score as stale; retry on next interval |
| Offboarding step fails | Mark step as failed; alert operator; manual intervention required |
| Duplicate risk report | Return risk_already_flagged; update existing record |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events
* **Recommends:** procurement, notifications, reporting
