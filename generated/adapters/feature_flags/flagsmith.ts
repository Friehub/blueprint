// flagsmith.ts
// Auto-generated adapter for flagsmith → feature_flags
// Do not edit manually

import type { FeatureFlagsContract } from '../interfaces/feature_flags';

export class FlagsmithAdapter implements FeatureFlagsContract {
  constructor(private config: {
  api_key: string;
  environment_key: string;
  }) {}

  isEnabled(flagKey: unknown, userId?: unknown, context?: unknown): Promise<boolean> {
    // TODO: Implement with isEnabled
    throw new Error('Not implemented');
  }
  getVariant(flagKey: unknown, userId?: unknown, context?: unknown): Promise<Variant> {
    // TODO: Implement with getVariant
    throw new Error('Not implemented');
  }
  setFlag(flagKey: unknown, enabled: unknown, rules?: unknown): Promise<Flag> {
    // TODO: Implement with setFlag
    throw new Error('Not implemented');
  }
  archiveFlag(flagKey: unknown): Promise<void> {
    // TODO: Implement with archiveFlag
    throw new Error('Not implemented');
  }
  listFlags(): Promise<Flag[]> {
    // TODO: Implement with listFlags
    throw new Error('Not implemented');
  }
  getFlag(flagKey: unknown): Promise<Flag> {
    // TODO: Implement with getFlag
    throw new Error('Not implemented');
  }
  rolloutToPercent(flagKey: unknown, percentage: unknown): Promise<Flag> {
    // TODO: Implement with rolloutToPercent
    throw new Error('Not implemented');
  }
  evaluateAll(userId: unknown, context?: unknown): Promise<Record<string, boolean>> {
    // TODO: Implement with evaluateAll
    throw new Error('Not implemented');
  }
}
