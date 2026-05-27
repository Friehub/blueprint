# Module Contract: `seat_pricing`

---

### `seat_pricing`
Per-seat pricing rules, volume discounts, overage rates, and billing adjustment policies for SaaS accounts.

**Functions**
```
createSeatPriceRule(account_id, rule) → SeatPriceRule
getSeatPriceRule(account_id, seat_type?) → SeatPriceRule?
listSeatPriceRules(account_id, options?) → PaginatedResult<SeatPriceRule>
updateSeatPriceRule(rule_id, data) → SeatPriceRule
archiveSeatPriceRule(rule_id) → SeatPriceRule
quoteSeatCost(account_id, seat_count, seat_type?, effective_at?) → SeatPriceQuote
applySeatAdjustment(account_id, adjustment) → SeatPriceAdjustment
```

**Types**
```
SeatPriceRule { id, account_id, seat_type?, pricing_model, unit_price, currency, min_quantity?, max_quantity?, effective_at, archived_at? }
SeatPriceQuote { account_id, seat_count, seat_type?, subtotal, discount_total, total, currency, effective_at }
SeatPriceAdjustment { id, account_id, rule_id?, amount, currency, reason, created_at }
PricingModel = flat | volume | tiered | overage | negotiated
```

**Invariants**
- Price rules must be time-bounded or versioned so historical quotes remain reproducible.
- Archived rules must not affect future quotes, but must remain readable for audit.
- Quote output must be deterministic for the same inputs and effective date.

**Providers:** custom billing engines, Stripe price books, Chargebee pricing, SaaS quote engines

---

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Price rule writes must be durably recorded before quotes use them.
- **Idempotency:** `createSeatPriceRule`, `updateSeatPriceRule`, and `applySeatAdjustment` must be idempotent on rule or adjustment identity.
- **Storage Model:** Durable pricing rule store with historical snapshots.
- **Dependencies:** `plan_catalog`, `seat_management`, `billing`, `audit_log`, `feature_flags`.
- **Errors:** `PRICE_RULE_NOT_FOUND`, `PRICE_RULE_CONFLICT`, `INVALID_PRICING_MODEL`, `QUOTE_UNAVAILABLE`, `ADJUSTMENT_NOT_ALLOWED`.
