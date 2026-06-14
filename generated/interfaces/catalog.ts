// catalog.ts
// Auto-generated from contracts/catalog.md
// Do not edit manually

export interface Product {
  id: string;
  name: unknown;
  description: unknown;
  images: unknown;
  status: unknown;
  variants: unknown;
  metadata: unknown;
}

export interface Variant {
  id: string;
  productId: string;
  sku: unknown;
  options: unknown;
  price: unknown;
}

export interface Price {
  amount: unknown;
  currency: unknown;
  taxInclusive: unknown;
}

export type Productstatus = ProductStatus = active | draft | archived;

export interface Pricingrule {
  id: string;
  productId: string;
  scope: unknown;
  type: unknown;
  value: unknown;
  priority: unknown;
  active: unknown;
}

export interface Bundle {
  id: string;
  name: unknown;
  productIds: unknown;
  status: unknown;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type Pricingruletype = PricingRuleType = fixed | percentage | formula | override | tiered;

export type Bundlestatus = BundleStatus = draft | active | archived;

export interface CatalogContract {
  getProduct(productId: unknown): Promise<Product>;
  getProducts(ids: unknown): Promise<Product[]>;
  searchProducts(query: unknown, options?: unknown): Promise<PaginatedResult<Product>>;
  createProduct(data: unknown): Promise<Product>;
  updateProduct(productId: unknown, data: unknown): Promise<Product>;
  archiveProduct(productId: unknown): Promise<void>;
  getVariant(variantId: unknown): Promise<Variant>;
  getVariantsByProduct(productId: unknown): Promise<Variant[]>;
  createVariant(productId: unknown, data: unknown): Promise<Variant>;
  updateVariant(variantId: unknown, data: unknown): Promise<Variant>;
  getPricing(variantId: unknown, context?: unknown): Promise<Price>;
  createPricingRule(productId: unknown, rule: unknown): Promise<PricingRule>;
  getPricingRule(ruleId: unknown): Promise<PricingRule>;
  listPricingRules(productId: unknown, options?: unknown): Promise<PaginatedResult<PricingRule>>;
  updatePricingRule(ruleId: unknown, data: unknown): Promise<PricingRule>;
  archivePricingRule(ruleId: unknown): Promise<PricingRule>;
  createBundle(data: unknown): Promise<Bundle>;
  getBundle(bundleId: unknown): Promise<Bundle>;
  listBundles(input: unknown, options?: unknown): Promise<PaginatedResult<Bundle>>;
  updateBundle(bundleId: unknown, data: unknown): Promise<Bundle>;
  archiveBundle(bundleId: unknown): Promise<Bundle>;
}
