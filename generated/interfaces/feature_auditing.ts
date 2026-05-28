// feature_auditing.ts
// Auto-generated from contracts/feature_auditing.md
// Do not edit manually

export interface Featureauditentry {
  id: string;
  flagKey: string;
  action: unknown;
  createdAt: Timestamp;
}

export interface Featureauditexport {
  id: string;
  status: unknown;
  format: unknown;
  createdAt: Timestamp;
}

export interface Featurediff {
  flagKey: string;
  fromVersion: unknown;
  toVersion: unknown;
  changes: unknown;
}

export type Featureauditaction = FeatureAuditAction = created | updated | archived | rollout_started | rollout_changed | rollout_completed | reverted | evaluated;

export interface FeatureAuditingContract {
  getFeatureAuditTrail(flagKey: unknown, options?: unknown): Promise<PaginatedResult<FeatureAuditEntry>>;
  getFeatureAuditEntry(entryId: unknown): Promise<FeatureAuditEntry>;
  listFeatureAuditEntries(input: unknown, options?: unknown): Promise<PaginatedResult<FeatureAuditEntry>>;
  exportFeatureAudit(filters: unknown, format: unknown): Promise<FeatureAuditExport>;
  compareFeatureVersions(flagKey: unknown, fromVersion: unknown, toVersion: unknown): Promise<FeatureDiff>;
}
