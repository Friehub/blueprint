// avalara.test.ts
// Auto-generated conformance test for avalara → taxation
// Do not edit manually

import { AvalaraAdapter } from '../adapters/taxation/avalara';
import type { TaxationContract } from '../interfaces/taxation';

describe('AvalaraAdapter implements TaxationContract', () => {
  const adapter: TaxationContract = new AvalaraAdapter({
    account_id: 'test',
    license_key: 'test'
  });

  it('has calculateTax method', () => {
    expect(typeof adapter.calculateTax).toBe('function');
  });

  it('has getTaxRate method', () => {
    expect(typeof adapter.getTaxRate).toBe('function');
  });

  it('has listTaxRates method', () => {
    expect(typeof adapter.listTaxRates).toBe('function');
  });

  it('has setTaxProfile method', () => {
    expect(typeof adapter.setTaxProfile).toBe('function');
  });

  it('has getTaxProfile method', () => {
    expect(typeof adapter.getTaxProfile).toBe('function');
  });

  it('has validateTaxId method', () => {
    expect(typeof adapter.validateTaxId).toBe('function');
  });

  it('has previewTax method', () => {
    expect(typeof adapter.previewTax).toBe('function');
  });

});
