# Module Contract: `taxation`

---

### `taxation`
Tax calculation, jurisdiction lookup, tax profile management, and tax breakdown generation for commerce and SaaS billing.

**Functions**
```
calculateTax(amount, currency, jurisdiction, context?) → TaxBreakdown
getTaxRate(jurisdiction, tax_type?, effective_at?) → TaxRate?
listTaxRates(input, options?) → PaginatedResult<TaxRate>
setTaxProfile(entity_id, profile) → TaxProfile
getTaxProfile(entity_id) → TaxProfile?
validateTaxId(tax_id, jurisdiction) → TaxValidationResult
previewTax(line_items, jurisdiction, context?) → TaxPreview
```

**Types**
```
TaxBreakdown { subtotal, tax_total, total, currency, rates: TaxRate[] }
TaxRate { jurisdiction, tax_type, rate, effective_from, effective_to?, inclusive }
TaxProfile { entity_id, entity_type, jurisdiction, tax_exempt, tax_id?, nexus?, updated_at }
TaxValidationResult { valid, normalized_id?, reason? }
TaxPreview { jurisdiction, tax_total, lines: TaxLinePreview[] }
TaxLinePreview { line_ref, taxable_amount, tax_amount, rate }
```

**Invariants**
- Tax calculation must be deterministic for the same inputs and effective date.
- Inclusive and exclusive tax rules must be explicit.
- A tax profile cannot silently change historical calculations.

**Providers:** Avalara, TaxJar, Stripe Tax, Vertex, custom rule engines

---

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Tax profiles and rate snapshots must be durably recorded before they affect downstream pricing.
- **Idempotency:** `setTaxProfile` and any write path must be idempotent on entity identity and effective date.
- **Storage Model:** Durable tax profile store with rate snapshot history.
- **Dependencies:** `billing`, `invoicing`, `orders`, `subscriptions`, `config`, `audit_log`.
- **Errors:** `TAX_RATE_NOT_FOUND`, `INVALID_TAX_ID`, `JURISDICTION_UNSUPPORTED`, `TAX_PROFILE_CONFLICT`, `TAX_RULE_INVALID`.
