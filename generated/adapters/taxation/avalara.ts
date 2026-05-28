// avalara.ts
// Auto-generated adapter for avalara → taxation
// Do not edit manually

import type { TaxationContract } from '../interfaces/taxation';

export class AvalaraAdapter implements TaxationContract {
  constructor(private config: {
  account_id: string;
  license_key: string;
  }) {}

  calculateTax(amount: unknown, currency: unknown, jurisdiction: unknown, context?: unknown): Promise<TaxBreakdown> {
    // TODO: Implement with calculateTax
    throw new Error('Not implemented');
  }
  getTaxRate(jurisdiction: unknown, taxType?: unknown, effectiveAt?: unknown): Promise<TaxRate | undefined> {
    // TODO: Implement with getTaxRate
    throw new Error('Not implemented');
  }
  listTaxRates(input: unknown, options?: unknown): Promise<PaginatedResult<TaxRate>> {
    // TODO: Implement with listTaxRates
    throw new Error('Not implemented');
  }
  setTaxProfile(entityId: unknown, profile: unknown): Promise<TaxProfile> {
    // TODO: Implement with setTaxProfile
    throw new Error('Not implemented');
  }
  getTaxProfile(entityId: unknown): Promise<TaxProfile | undefined> {
    // TODO: Implement with getTaxProfile
    throw new Error('Not implemented');
  }
  validateTaxId(taxId: unknown, jurisdiction: unknown): Promise<TaxValidationResult> {
    // TODO: Implement with validateTaxId
    throw new Error('Not implemented');
  }
  previewTax(lineItems: unknown, jurisdiction: unknown, context?: unknown): Promise<TaxPreview> {
    // TODO: Implement with previewTax
    throw new Error('Not implemented');
  }
}
