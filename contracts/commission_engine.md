# Module Contract: `commission_engine`

**Version:** 0.1.0

---

### `commission_engine`
Marketplace commission calculation with tiered rates and priority-ordered rule evaluation.

**Functions**
```
calculateCommission(transaction: any) → CommissionCalculation
applyTier(transaction: any, tier: CommissionTier) → decimal
getEffectiveRate(rule: CommissionRule, transaction: any) → decimal
createRule(rule: CommissionRule) → CommissionRule
updateRule(rule_id: any, updates: any) → CommissionRule
deleteRule(rule_id: any) → void
listRules(filters?: any) → CommissionRule[]
getTier(rule_id: any, volume: decimal) → CommissionTier
```

**Types**
```
CommissionRule { id, name, description, priority: int, conditions: RuleCondition[], tiers: CommissionTier[], default_rate: decimal, status: active | inactive, created_at, updated_at }
RuleCondition { field: string, operator: eq | neq | gt | gte | lt | lte | in | contains, value: any }
CommissionTier { id, min_volume: decimal, max_volume?: decimal, rate: decimal, type: percentage | flat }
CommissionCalculation { rule_id, tier_id?, rate_applied, commission_amount, transaction_amount, currency, breakdown: CalculationBreakdown[] }
CalculationBreakdown { rule_name, rate, amount, type }
```

**Invariants**
- Total commission must not exceed the transaction amount; negative commission is prohibited
- Rules must be evaluated in `priority` order (lowest number first); first matching rule wins
- Commission must not exceed the maximum configured cap per rule
- `getEffectiveRate` must return the rate for the highest applicable tier based on transaction volume
- A rule with `priority` value already assigned to another rule must return `PRIORITY_CONFLICT`
- Tier volume ranges must not overlap within the same rule; gaps between tiers are allowed and fall back to `default_rate`
- Deleting a rule must not affect already-calculated commissions (historical record retention)

**Providers:** built-in rule engine, Stripe Connect, custom calculator, spreadsheet import

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Rule evaluation is synchronous and deterministic; commission results must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once`
* **Details:** Commission is calculated once per transaction and stored as a ledger entry

### Worker Scaling
* **Policy:** Rule evaluation is stateless; rules are cached in memory and refreshed periodically

### Multi-Region Behavior
* **Mode:** Commission rules are global; same rules apply across all regions
* **Details:** Currency conversion for cross-region transactions must be applied before commission calculation

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).
* Commission-specific errors: `PRIORITY_CONFLICT`, `TIER_OVERLAP`, `COMMISSION_EXCEEDS_AMOUNT`, `RULE_CONDITION_MALFORMED`, `NO_MATCHING_RULE`, `TIER_NOT_FOUND`

### Event Emission
```
calculateCommission    → commission.calculated       { transaction_id, rule_id, commission_amount, rate_applied }
createRule             → commission.rule.created      { rule_id, name, priority }
updateRule             → commission.rule.updated      { rule_id, changes }
deleteRule             → commission.rule.deleted      { rule_id }
```

### Temporal Constraints
```
Commission settlement:
    settlement_window:    T+1 business days
    retention:           indefinite (financial records)
```

### Storage Model
* **Model:** Rules stored in relational database with JSON conditions; calculations stored as ledger entries
* **Details:** Rules are cached in the application layer; rule changes propagate within cache TTL (30 seconds)

### Observability
* **Tracing Spans:** Every commission operation creates a span. Span names follow `commission.<function>`.
* **Telemetry Metrics:**
```
blueprint_commission_operation_total            counter { function, result }
blueprint_commission_operation_duration_ms      histogram { function }
blueprint_commission_calculated_total           counter { rule_id }
blueprint_commission_amount                   histogram { currency }
blueprint_commission_effective_rate            histogram
blueprint_commission_errors_total              counter { function, error_code }
blueprint_commission_rules_active             gauge
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events
* **Recommends:** credit_system (for commission payouts)

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE commission_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  priority        INT NOT NULL UNIQUE,
  conditions      JSONB NOT NULL DEFAULT '[]',
  tiers           JSONB NOT NULL DEFAULT '[]',
  default_rate    DECIMAL(5,4) NOT NULL,
  max_cap         DECIMAL(20,4),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_commission_rules_priority ON commission_rules(priority);
CREATE INDEX idx_commission_rules_status ON commission_rules(status);

CREATE TABLE commission_calculations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id    UUID NOT NULL,
  rule_id           UUID REFERENCES commission_rules(id),
  tier_id           UUID,
  transaction_amount DECIMAL(20,4) NOT NULL,
  commission_amount DECIMAL(20,4) NOT NULL,
  rate_applied      DECIMAL(5,4) NOT NULL,
  currency          TEXT NOT NULL,
  breakdown         JSONB NOT NULL DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_commission_calc_transaction ON commission_calculations(transaction_id);
CREATE INDEX idx_commission_calc_rule ON commission_calculations(rule_id);
CREATE INDEX idx_commission_calc_created ON commission_calculations(created_at);
```

### Breaking Change Policy
- Adding new condition operators is backward-compatible.
- Changing the rule priority evaluation order (e.g., highest first) requires a MAJOR version bump.
- Removing condition operators requires a MAJOR version bump.
- Adding new fields to `RuleCondition` is backward-compatible.
- Changing commission precision requires a MAJOR version bump.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| No matching rule | Transaction conditions do not match any active rule | Apply platform default rate; log warning |
| Tier overlap | Two tiers with overlapping volume ranges | Reject rule save with TIER_OVERLAP |
| Commission exceeds amount | Rate results in commission > transaction amount | Cap at transaction amount; alert operator |
| Missing default_rate | No tiers match and no default configured | Reject with RULE_MALFORMED |
| Priority conflict | Two rules share the same priority | Reject second rule with PRIORITY_CONFLICT |
