// onfido.test.ts
// Auto-generated conformance test for onfido → kyc
// Do not edit manually

import { OnfidoAdapter } from '../adapters/kyc/onfido';
import type { KycContract } from '../interfaces/kyc';

describe('OnfidoAdapter implements KycContract', () => {
  const adapter: KycContract = new OnfidoAdapter({
    api_token: 'test',
    region: 'test'
  });

  it('has submitVerification method', () => {
    expect(typeof adapter.submitVerification).toBe('function');
  });

  it('has getVerification method', () => {
    expect(typeof adapter.getVerification).toBe('function');
  });

  it('has getUserVerification method', () => {
    expect(typeof adapter.getUserVerification).toBe('function');
  });

  it('has getVerificationStatus method', () => {
    expect(typeof adapter.getVerificationStatus).toBe('function');
  });

  it('has updateVerification method', () => {
    expect(typeof adapter.updateVerification).toBe('function');
  });

  it('has rejectVerification method', () => {
    expect(typeof adapter.rejectVerification).toBe('function');
  });

  it('has approveVerification method', () => {
    expect(typeof adapter.approveVerification).toBe('function');
  });

  it('has listPendingVerifications method', () => {
    expect(typeof adapter.listPendingVerifications).toBe('function');
  });

});
