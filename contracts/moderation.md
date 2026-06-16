# Module Contract: `moderation`

**Version:** 0.1.0

---

### `moderation`
Cross-domain moderation cases, reviewer workflows, decisions, escalations, and moderation exports.

**Functions**
```
createCase(subject_ref: any, reason: any, metadata?: any) → ModerationCase
getCase(case_id: any) → ModerationCase
listCases(input: any, options?: any) → PaginatedResult<ModerationCase>
assignReviewer(case_id: any, reviewer_id: any) → ModerationCase
recordDecision(case_id: any, decision: any, reason?: any) → ModerationCase
escalateCase(case_id: any, level?: any) → ModerationCase
closeCase(case_id: any) → ModerationCase
exportCases(filters: any, format: string) → ModerationExport
```

**Types**
```
ModerationCase { id, subject_type, subject_id, status, reason, created_at, assigned_to?, decided_at?, closed_at? }
ModerationDecision = approve | reject | hide | delete | restore | escalate
ModerationStatus = open | assigned | under_review | escalated | closed | exported
ModerationExport { id, status, format, created_at, expires_at?, url? }
```

**Invariants**
- A closed case cannot be decided again without reopening.
- Decisions must be preserved as an immutable audit trail.
- Exporting cases must not mutate moderation state.

**Providers:** Trust & Safety workflows, content moderation queues, internal review systems, compliance export tools

---

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Case state and decisions must be strongly consistent.
- **Idempotency:** `createCase`, `recordDecision`, and `closeCase` must be idempotent on case identity.
- **Storage Model:** Durable moderation case store with decision history and export records.
- **Dependencies:** `audit_log`, `notifications`, `queues`, `storage`, `users`.
- **Errors:** `CASE_NOT_FOUND`, `CASE_ALREADY_CLOSED`, `REVIEWER_NOT_ASSIGNED`, `DECISION_INVALID`, `EXPORT_NOT_READY`, `SUBJECT_NOT_MODERATABLE`.
