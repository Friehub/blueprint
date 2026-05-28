// taxation.ts
// Auto-generated from contracts/taxation.md
// Do not edit manually

export interface Taxbreakdown {
  subtotal: unknown;
  taxTotal: number;
  total: unknown;
  currency: unknown;
  rates: TaxRate[];
}

export interface Taxrate {
  jurisdiction: unknown;
  taxType: string;
  rate: unknown;
  effectiveFrom: unknown;
  inclusive: unknown;
}

export interface Taxprofile {
  entityId: string;
  entityType: string;
  jurisdiction: unknown;
  taxExempt: unknown;
  updatedAt: Timestamp;
}

export interface Taxvalidationresult {
  valid: unknown;
}

export interface Taxpreview {
  jurisdiction: unknown;
  taxTotal: number;
  lines: TaxLinePreview[];
}

export interface Taxlinepreview {
  lineRef: unknown;
  taxableAmount: number;
  taxAmount: number;
  rate: unknown;
}

export interface TaxationContract {
  calculateTax(amount: unknown, currency: unknown, jurisdiction: unknown, context?: unknown): Promise<TaxBreakdown>;
  getTaxRate(jurisdiction: unknown, taxType?: unknown, effectiveAt?: unknown): Promise<TaxRate | undefined>;
  listTaxRates(input: unknown, options?: unknown): Promise<PaginatedResult<TaxRate>>;
  setTaxProfile(entityId: unknown, profile: unknown): Promise<TaxProfile>;
  getTaxProfile(entityId: unknown): Promise<TaxProfile | undefined>;
  validateTaxId(taxId: unknown, jurisdiction: unknown): Promise<TaxValidationResult>;
  previewTax(lineItems: unknown, jurisdiction: unknown, context?: unknown): Promise<TaxPreview>;
}
