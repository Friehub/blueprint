# Module Contract: `catalog`

---

### `catalog`
Product and variant management.
This module also owns product pricing rules and bundles.

**Functions**
```
getProduct(product_id) → Product
getProducts(ids) → Product[]
searchProducts(query, options?) → PaginatedResult<Product>
createProduct(data) → Product
updateProduct(product_id, data) → Product
archiveProduct(product_id) → void
getVariant(variant_id) → Variant
getVariantsByProduct(product_id) → Variant[]
createVariant(product_id, data) → Variant
updateVariant(variant_id, data) → Variant
getPricing(variant_id, context?) → Price
createPricingRule(product_id, rule) → PricingRule
getPricingRule(rule_id) → PricingRule
listPricingRules(product_id, options?) → PaginatedResult<PricingRule>
updatePricingRule(rule_id, data) → PricingRule
archivePricingRule(rule_id) → PricingRule
createBundle(data) → Bundle
getBundle(bundle_id) → Bundle
listBundles(input, options?) → PaginatedResult<Bundle>
updateBundle(bundle_id, data) → Bundle
archiveBundle(bundle_id) → Bundle
```

**Types**
```
Product { id, name, description, images, status, variants, metadata }
Variant { id, product_id, sku, options, price, compare_at_price?, weight? }
Price { amount, currency, compare_at?, tax_inclusive }
ProductStatus = active | draft | archived
PricingRule { id, product_id, scope, type, value, priority, active, effective_at?, archived_at? }
Bundle { id, name, product_ids, variant_ids?, price_override?, status, metadata?, created_at, updated_at }
PricingRuleType = fixed | percentage | formula | override | tiered
BundleStatus = draft | active | archived
```

**Invariants**
- Pricing rules must be evaluated deterministically by priority and effective date.
- Bundles must reference existing products or variants.
- Archiving a bundle must not mutate the underlying product records.

**Providers:** custom database, Medusa, Shopify API, Saleor

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Standard transactional consistency

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
* None explicitly defined.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `catalog.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events
* **Recommends:** search, caching
