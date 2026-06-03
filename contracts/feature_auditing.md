# Module Contract: `feature_auditing`

**Version:** 0.1.0

---

### `feature_auditing`
Feature flag and rollout history, assignment decisions, and governance audit trails.

**Functions**
```
getFeatureAuditTrail(flag_key, options?) → PaginatedResult<FeatureAuditEntry>
getFeatureAuditEntry(entry_id) → FeatureAuditEntry
listFeatureAuditEntries(input, options?) → PaginatedResult<FeatureAuditEntry>
exportFeatureAudit(filters, format) → FeatureAuditExport
compareFeatureVersions(flag_key, from_version, to_version) → FeatureDiff
```

**Types**
```
FeatureAuditEntry { id, flag_key, action, actor_id?, before?, after?, created_at }
FeatureAuditExport { id, status, format, created_at, expires_at?, url? }
FeatureDiff { flag_key, from_version, to_version, changes }
FeatureAuditAction = created | updated | archived | rollout_started | rollout_changed | rollout_completed | reverted | evaluated
```

**Invariants**
- Feature audit records must be immutable.
- Audit trails must preserve before/after snapshots where available.
- Exporting audit data must not mutate the audit source.

**Providers:** internal audit stores, LaunchDarkly export logs, Unleash audit trails, GrowthBook audit APIs

---

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Feature audit entries must be durably recorded before they are exposed to queries.
- **Idempotency:** If a write path is supported by the adapter, it must be idempotent on the audit action identity.
- **Storage Model:** Append-only feature audit store with export artifacts.
- **Dependencies:** `feature_flags`, `audit_log`, `storage`, `users`.
- **Errors:** `FEATURE_AUDIT_NOT_FOUND`, `EXPORT_NOT_READY`, `FEATURE_DIFF_UNAVAILABLE`, `FLAG_NOT_FOUND`, `AUDIT_EXPORT_TOO_LARGE`.
