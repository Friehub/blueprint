# Module Contract: `catalog`

**Version:** 0.1.0

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
* **Details:** Product, variant, and pricing data must be immediately consistent to prevent checkout discrepancies and pricing race conditions

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for catalog lifecycle events.
* **Details:** Duplicate product creation retries must be idempotent on external SKU or slug.

### Worker Scaling
* **Policy:** Product search indexing, bulk import, and pricing rule evaluation must be independently scalable.

### Multi-Region Behavior
* **Mode:** Catalog data is global; writes are performed in the primary region and replicated to read replicas.
* **Details:** Read replicas may serve stale data; product creation and pricing updates must be strongly consistent in the primary region.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Required Functions:**
  - `createProduct(data, idempotency_key?)`
  - `createVariant(product_id, data, idempotency_key?)`
  - `createPricingRule(product_id, rule, idempotency_key?)`
  - `createBundle(data, idempotency_key?)`

### Backpressure
* If bulk import or search indexing is saturated, writes must be queued and acknowledged synchronously with a `draft` status; full indexing is async.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).
* Domain errors: `PRODUCT_NOT_FOUND`, `VARIANT_NOT_FOUND`, `PRICING_RULE_NOT_FOUND`, `BUNDLE_NOT_FOUND`, `SKU_CONFLICT`, `PRODUCT_ARCHIVED`, `VARIANT_CONFLICT`, `PRICING_RULE_OVERLAP`, `BUNDLE_CYCLE_DETECTED`.

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createProduct       → catalog.product.created           { product_id, status }
updateProduct       → catalog.product.updated           { product_id, changed_fields }
archiveProduct      → catalog.product.archived          { product_id }
createVariant       → catalog.variant.created           { variant_id, product_id, sku }
updateVariant       → catalog.variant.updated           { variant_id, changed_fields }
createPricingRule   → catalog.pricing_rule.created      { rule_id, product_id, type }
updatePricingRule   → catalog.pricing_rule.updated      { rule_id, changed_fields }
createBundle        → catalog.bundle.created            { bundle_id, product_ids }
archiveBundle       → catalog.bundle.archived           { bundle_id }
```

### Temporal Constraints
```
Pricing rule:
    effective_at:       must be in the future or now
    on_effective:       activate rule; re-evaluate product pricing

    archived_rule:
        retention:      90 days after archive
        on_expiry:      eligible for hard delete

Bundle:
    active_duration:    no limit (manual archive only)
    on_product_archive: bundle remains but product is excluded from fulfillment

Product:
    draft_auto_archive: 90 days without update
    on_expiry:          auto-archive; preserve data for restore
```

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE catalog_products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  images      TEXT[] DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'active', 'archived')),
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_catalog_products_status ON catalog_products(status, created_at DESC);
CREATE INDEX idx_catalog_products_name ON catalog_products USING gin(name gin_trgm_ops);

CREATE TABLE catalog_variants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
  sku             TEXT NOT NULL UNIQUE,
  options         JSONB NOT NULL DEFAULT '{}',
  price_amount    NUMERIC(19,4) NOT NULL,
  price_currency  TEXT NOT NULL DEFAULT 'USD',
  compare_at_price NUMERIC(19,4),
  weight          NUMERIC(10,4),
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive', 'archived')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_catalog_variants_product ON catalog_variants(product_id);
CREATE INDEX idx_catalog_variants_sku ON catalog_variants(sku);

CREATE TABLE catalog_pricing_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
  scope         TEXT NOT NULL DEFAULT 'product'
                  CHECK (scope IN ('product', 'variant', 'category', 'global')),
  rule_type     TEXT NOT NULL CHECK (rule_type IN ('fixed', 'percentage', 'formula', 'override', 'tiered')),
  value         JSONB NOT NULL,
  priority      INTEGER NOT NULL DEFAULT 0,
  active        BOOLEAN NOT NULL DEFAULT true,
  effective_at  TIMESTAMPTZ,
  archived_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_catalog_pricing_rules_product ON catalog_pricing_rules(product_id, priority DESC);
CREATE INDEX idx_catalog_pricing_rules_active ON catalog_pricing_rules(active, effective_at) WHERE active;

CREATE TABLE catalog_bundles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  product_ids     UUID[] NOT NULL,
  variant_ids     UUID[],
  price_override  NUMERIC(19,4),
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'active', 'archived')),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_catalog_bundles_status ON catalog_bundles(status);
```

### Storage Model
* **Model:** Durable product catalog with transactional consistency.
* **Details:** Product, variant, pricing, and bundle data use PostgreSQL. Product images and assets live in object storage referenced by URL.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `catalog.<function>`.
* **Telemetry Metrics:**
```
blueprint_catalog_operation_total                counter { function, result }
blueprint_catalog_operation_duration_ms          histogram { function }
blueprint_catalog_errors_total                   counter { function, error_code }
blueprint_catalog_products_total                  gauge { status }
blueprint_catalog_variants_per_product            histogram
blueprint_catalog_pricing_rules_total             gauge { rule_type }
blueprint_catalog_search_latency_ms               histogram
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events
* **Recommends:** search, caching, inventory, promotions

### Breaking Change Policy
- Adding a new product status or pricing rule type is additive and backward-compatible.
- Removing or renaming an existing status or rule type requires a MAJOR version bump.
- Changing the pricing rule evaluation priority order requires a MAJOR version bump.
- Adding new required fields to `createProduct` or `createVariant` requires a MAJOR version bump.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| SKU conflict during creation | Duplicate SKU submitted | Return SKU_CONFLICT; recommend unique SKU |
| Pricing rule overlap | Multiple active rules with same priority | Evaluate by priority then effective_at; log warning |
| Bundle references archived product | Product archived after bundle creation | Bundle remains active; product excluded from fulfillment |
| Product image URL broken | Object storage key renamed | Periodic URL health check; emit alert on 404 |
| Variant price contradicts pricing rule | Manual update bypasses rule engine | Evaluate rule after update; flag discrepancy in audit |
