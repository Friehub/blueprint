// feature_flags.ts
// Auto-generated from contracts/feature_flags.md
// Do not edit manually

export interface Flag {
  key: unknown;
  enabled: unknown;
}

export interface Variant {
  key: unknown;
  value: unknown;
  weight: unknown;
}

export interface Rolloutrule {
  attribute: unknown;
  operator: unknown;
  value: unknown;
  percentage: unknown;
}

export interface FeatureFlagsContract {
  isEnabled(flagKey: unknown, userId?: unknown, context?: unknown): Promise<boolean>;
  getVariant(flagKey: unknown, userId?: unknown, context?: unknown): Promise<Variant>;
  setFlag(flagKey: unknown, enabled: unknown, rules?: unknown): Promise<Flag>;
  archiveFlag(flagKey: unknown): Promise<void>;
  listFlags(): Promise<Flag[]>;
  getFlag(flagKey: unknown): Promise<Flag>;
  rolloutToPercent(flagKey: unknown, percentage: unknown): Promise<Flag>;
  evaluateAll(userId: unknown, context?: unknown): Promise<Record<string, boolean>>;
}
