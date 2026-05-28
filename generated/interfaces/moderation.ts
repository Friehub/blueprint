// moderation.ts
// Auto-generated from contracts/moderation.md
// Do not edit manually

export interface Moderationcase {
  id: string;
  subjectType: string;
  subjectId: string;
  status: unknown;
  reason: unknown;
  createdAt: Timestamp;
}

export type Moderationdecision = ModerationDecision = approve | reject | hide | delete | restore | escalate;

export type Moderationstatus = ModerationStatus = open | assigned | under_review | escalated | closed | exported;

export interface Moderationexport {
  id: string;
  status: unknown;
  format: unknown;
  createdAt: Timestamp;
}

export interface ModerationContract {
  createCase(subjectRef: unknown, reason: unknown, metadata?: unknown): Promise<ModerationCase>;
  getCase(caseId: unknown): Promise<ModerationCase>;
  listCases(input: unknown, options?: unknown): Promise<PaginatedResult<ModerationCase>>;
  assignReviewer(caseId: unknown, reviewerId: unknown): Promise<ModerationCase>;
  recordDecision(caseId: unknown, decision: unknown, reason?: unknown): Promise<ModerationCase>;
  escalateCase(caseId: unknown, level?: unknown): Promise<ModerationCase>;
  closeCase(caseId: unknown): Promise<ModerationCase>;
  exportCases(filters: unknown, format: unknown): Promise<ModerationExport>;
}
