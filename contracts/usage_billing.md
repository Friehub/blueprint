# Module Contract: `usage_billing`

**Version:** 0.1.0

---

### `usage_billing`
Usage aggregation, billable metric conversion, and metered charge creation for SaaS products.

**Functions**
```
recordUsage(account_id: any, metric: any, value: any, occurred_at?: any, metadata?: any) → UsageRecord
getUsage(account_id: any, metric: any, options?: any) → PaginatedResult<UsageRecord>
aggregateUsage(account_id: any, period: any, metric?: any) → UsageSummary
createUsageCharge(account_id: any, period: any, metadata?: any) → UsageCharge
finalizeUsageCharge(charge_id: any) → UsageCharge
adjustUsageCharge(charge_id: any, adjustment: any) → UsageCharge
closeUsagePeriod(account_id: any, period: any) → UsagePeriod
```

**Types**
```
UsageRecord { id, account_id, metric, value, occurred_at, metadata? }
UsageSummary { account_id, metric, period, total, billed_total, unit, finalized }
UsageCharge { id, account_id, period, status, amount, currency, created_at, finalized_at? }
UsagePeriod = open | closing | closed | reopened
```

**Invariants**
- Usage records must be append-only.
- A closed period cannot accept new usage without reopening.
- Charges must be derived from an auditable aggregation of usage records.

**Providers:** internal metering pipelines, Stripe metered billing, Chargebee metering, custom usage ledger systems

---

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Usage recording must be durable before aggregation is published.
- **Idempotency:** `recordUsage` and `createUsageCharge` must be idempotent on account-metric-period fingerprints.
- **Storage Model:** Append-only usage ledger with period summaries and charge history.
- **Dependencies:** `billing`, `ledger`, `usage_metering`, `audit_log`, `jobs`.
- **Errors:** `USAGE_NOT_FOUND`, `PERIOD_CLOSED`, `CHARGE_ALREADY_FINALIZED`, `METRIC_NOT_FOUND`, `USAGE_CONFLICT`, `INVALID_USAGE_PERIOD`.
