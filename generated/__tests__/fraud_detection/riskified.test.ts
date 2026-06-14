// riskified.test.ts
// Auto-generated conformance test for riskified → fraud_detection
// Do not edit manually

import { RiskifiedAdapter } from '../adapters/fraud_detection/riskified';
import type { FraudDetectionContract } from '../interfaces/fraud_detection';

describe('RiskifiedAdapter implements FraudDetectionContract', () => {
  const adapter: FraudDetectionContract = new RiskifiedAdapter({
    api_key: 'test',
    domain: 'test'
  });

  it('has scoreTransaction method', () => {
    expect(typeof adapter.scoreTransaction).toBe('function');
  });

  it('has scoreSignUp method', () => {
    expect(typeof adapter.scoreSignUp).toBe('function');
  });

  it('has scoreLogin method', () => {
    expect(typeof adapter.scoreLogin).toBe('function');
  });

  it('has reportFraud method', () => {
    expect(typeof adapter.reportFraud).toBe('function');
  });

  it('has blockEntity method', () => {
    expect(typeof adapter.blockEntity).toBe('function');
  });

  it('has unblockEntity method', () => {
    expect(typeof adapter.unblockEntity).toBe('function');
  });

  it('has isBlocked method', () => {
    expect(typeof adapter.isBlocked).toBe('function');
  });

  it('has getRiskHistory method', () => {
    expect(typeof adapter.getRiskHistory).toBe('function');
  });

});
