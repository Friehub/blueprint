# Module Contract: `plan_catalog`

**Version:** 0.1.0

---

### `plan_catalog`
Product plan definitions, feature entitlements, and pricing structure for SaaS offerings.

**Functions**
```
createPlan(data) → Plan
getPlan(plan_id) → Plan
listPlans(options?) → PaginatedResult<Plan>
updatePlan(plan_id, data) → Plan
archivePlan(plan_id) → Plan
getPlanFeatures(plan_id) → Feature[]
comparePlans(plan_ids) → PlanComparison
```

**Types**
```
Plan { id, name, description?, status, currency, interval, price, features, limits, created_at, updated_at }
Feature { key, enabled, metadata? }
PlanComparison { plan_ids, differences }
PlanStatus = active | deprecated | archived
```

**Invariants**
- Plan identifiers must be stable and unique.
- Archived plans must remain readable but cannot be assigned to new subscriptions.
- Feature and limit definitions must be explicit, not implied.

**Providers:** custom SaaS catalog, Stripe Prices/Products, Chargebee catalog, Paddle catalog, internal product catalog systems

---

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Plan changes must be strongly consistent and auditable.
- **Idempotency:** `createPlan` and `updatePlan` must be idempotent on plan identity or stable fingerprint.
- **Storage Model:** Durable plan catalog with version history and archival state.
- **Dependencies:** `billing`, `feature_flags`, `audit_log`, `permissions`.
- **Errors:** `PLAN_NOT_FOUND`, `PLAN_CONFLICT`, `PLAN_NOT_EDITABLE`, `FEATURE_CONFLICT`, `INVALID_LIMITS`.
