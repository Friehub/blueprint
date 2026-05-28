// flagsmith.test.ts
// Auto-generated conformance test for flagsmith → feature_flags
// Do not edit manually

import { FlagsmithAdapter } from '../adapters/feature_flags/flagsmith';
import type { FeatureFlagsContract } from '../interfaces/feature_flags';

describe('FlagsmithAdapter implements FeatureFlagsContract', () => {
  const adapter: FeatureFlagsContract = new FlagsmithAdapter({
    api_key: 'test',
    environment_key: 'test'
  });

  it('has isEnabled method', () => {
    expect(typeof adapter.isEnabled).toBe('function');
  });

  it('has getVariant method', () => {
    expect(typeof adapter.getVariant).toBe('function');
  });

  it('has setFlag method', () => {
    expect(typeof adapter.setFlag).toBe('function');
  });

  it('has archiveFlag method', () => {
    expect(typeof adapter.archiveFlag).toBe('function');
  });

  it('has listFlags method', () => {
    expect(typeof adapter.listFlags).toBe('function');
  });

  it('has getFlag method', () => {
    expect(typeof adapter.getFlag).toBe('function');
  });

  it('has rolloutToPercent method', () => {
    expect(typeof adapter.rolloutToPercent).toBe('function');
  });

  it('has evaluateAll method', () => {
    expect(typeof adapter.evaluateAll).toBe('function');
  });

});
