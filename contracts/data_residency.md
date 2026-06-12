# Module Contract: `data_residency`

**Version:** 0.1.0

---

### `data_residency`
Data sovereignty enforcement with region-aware routing and compliance verification.

**Functions**
```
declareResidency(data_domain, region) → ResidencyRule
getResidencyRule(data_domain) → ResidencyRule?
listResidencyRules(region?) → ResidencyRule[]
routeRequest(request, data_domains) → RouteDecision
verifyCompliance(data_domain) → ComplianceReport
updateResidencyRule(rule_id, changes) → ResidencyRule
removeResidencyRule(rule_id) → void
```

**Types**
```
ResidencyRule { id, data_domain, region, enforcement: strict|soft, created_at }
RouteDecision { data_domain, target_region, allowed: bool, reason?, alternative_region? }
ComplianceReport { data_domain, region, compliant: bool, checks: ComplianceCheck[], last_verified }
ComplianceCheck { check, passed: bool, detail, timestamp }
```

**Invariants**
- `routeRequest` for a data domain with a `strict` enforcement must deny any request that would store or process data outside the declared region
- A data domain with no residency rule must be treated as `soft` enforcement (logged but not blocked)
- Removing a residency rule must not physically relocate existing data -- migration is an explicit separate operation

**Providers:** custom, AWS S3 (bucket region), GCS (location), Azure (region pinning)

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Residency rules must be immediately consistent to prevent incorrect routing

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for residency rule lifecycle events.
* **Details:** Duplicate rule declarations must be idempotent (update existing, not create duplicate).

### Worker Scaling
* **Policy:** Route decision evaluation must be per-request with minimal overhead.

### Multi-Region Behavior
* **Mode:** This module IS the multi-region policy engine; it must evaluate against all declared regions.
* **Details:** Route decisions must be evaluated locally if the rule set is replicated, or centrally if the rule set is authoritative from one region.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* Route decision evaluation must complete within request budget; if the rule store is unavailable, deny with a clear error.

### Error Taxonomy
### Module-Specific Errors
```
declareResidency:
    rule_already_exists:       A residency rule for this data_domain already exists | use updateResidencyRule
    invalid_region:            Region is not a valid deployment region | check available regions

  getResidencyRule:
    rule_not_found:            No residency rule for this data_domain | verify data_domain

  routeRequest:
    region_unavailable:        Target region is unavailable | use alternative_region from RouteDecision
    no_rule_found:             No residency rule for any requested data_domain | treat as soft enforcement
    strict_denial:             Strict enforcement blocks request for this data_domain in target region | use alternative region

  updateResidencyRule:
    rule_not_found:            No residency rule with that ID | verify rule_id

  removeResidencyRule:
    rule_not_found:            No residency rule with that ID | verify rule_id
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
declareResidency → residency.rule.created      { data_domain, region, enforcement }
  routeRequest      → residency.request.routed   { data_domain, target_region, allowed }
  verifyCompliance  → residency.compliance.check { data_domain, compliant }
```

### Temporal Constraints
```
Compliance check interval:
    default:        24 hours
    on_expiry:      compliance status is stale; reverify before next route decision
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `data_residency.<function>`.
* **Telemetry Metrics:**
```
blueprint_data_residency_rules_total             { region, enforcement }
  blueprint_data_residency_routing_decisions_total { allowed }
  blueprint_data_residency_compliance_total         { compliant }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Storage Model
* **Model:** Strongly consistent residency rule store with append-only compliance check history.
* **Details:** Residency rules must be immediately consistent to prevent incorrect routing. Compliance check results are append-only for audit purposes.

### Database Schema

#### PostgreSQL
```sql
CREATE TYPE enforcement_level AS ENUM ('strict', 'soft');

CREATE TABLE data_residency_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_domain     TEXT NOT NULL UNIQUE,
  region          TEXT NOT NULL,
  enforcement     enforcement_level NOT NULL DEFAULT 'strict',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_residency_rules_region ON data_residency_rules(region);

CREATE TABLE data_residency_compliance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_domain     TEXT NOT NULL,
  region          TEXT NOT NULL,
  compliant       BOOLEAN NOT NULL,
  checks          JSONB NOT NULL DEFAULT '[]',
  verified_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_residency_compliance_domain ON data_residency_compliance(data_domain, verified_at DESC);
```

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events
* **Recommends:** audit_log, storage
