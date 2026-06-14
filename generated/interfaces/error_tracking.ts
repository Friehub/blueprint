// error_tracking.ts
// Auto-generated from contracts/error_tracking.md
// Do not edit manually

export interface Errorevent {
  id: string;
  fingerprint: unknown;
  message: unknown;
  severity: unknown;
  createdAt: Timestamp;
}

export interface Errorissue {
  id: string;
  fingerprint: unknown;
  title: unknown;
  status: unknown;
  severity: unknown;
  eventCount: number;
  firstSeenAt: Timestamp;
  lastSeenAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Alertrule {
  id: string;
  name: unknown;
  conditions: unknown;
  channels: unknown;
  enabled: unknown;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type Severity = Severity = debug | info | warning | error | critical;

export type Issuestatus = IssueStatus = open | muted | assigned | resolved | ignored;

export interface ErrorTrackingContract {
  recordError(error: unknown, context?: unknown): Promise<ErrorEvent>;
  getErrorEvent(eventId: unknown): Promise<ErrorEvent>;
  listErrorEvents(input: unknown, options?: unknown): Promise<PaginatedResult<ErrorEvent>>;
  getIssue(issueId: unknown): Promise<ErrorIssue>;
  listIssues(input: unknown, options?: unknown): Promise<PaginatedResult<ErrorIssue>>;
  updateIssue(issueId: unknown, data: unknown): Promise<ErrorIssue>;
  assignIssue(issueId: unknown, assigneeId: unknown): Promise<ErrorIssue>;
  muteIssue(issueId: unknown, reason?: unknown): Promise<ErrorIssue>;
  unmuteIssue(issueId: unknown): Promise<ErrorIssue>;
  createAlertRule(rule: unknown): Promise<AlertRule>;
  getAlertRule(ruleId: unknown): Promise<AlertRule>;
  listAlertRules(options?: unknown): Promise<AlertRule[]>;
}
