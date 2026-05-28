// bugsnag.ts
// Auto-generated adapter for bugsnag → error_tracking
// Do not edit manually

import type { ErrorTrackingContract } from '../interfaces/error_tracking';

export class BugsnagAdapter implements ErrorTrackingContract {
  constructor(private config: {
  api_key: string;
  }) {}

  recordError(error: unknown, context?: unknown): Promise<ErrorEvent> {
    // TODO: Implement with recordError
    throw new Error('Not implemented');
  }
  getErrorEvent(eventId: unknown): Promise<ErrorEvent> {
    // TODO: Implement with getErrorEvent
    throw new Error('Not implemented');
  }
  listErrorEvents(input: unknown, options?: unknown): Promise<PaginatedResult<ErrorEvent>> {
    // TODO: Implement with listErrorEvents
    throw new Error('Not implemented');
  }
  getIssue(issueId: unknown): Promise<ErrorIssue> {
    // TODO: Implement with getIssue
    throw new Error('Not implemented');
  }
  listIssues(input: unknown, options?: unknown): Promise<PaginatedResult<ErrorIssue>> {
    // TODO: Implement with listIssues
    throw new Error('Not implemented');
  }
  updateIssue(issueId: unknown, data: unknown): Promise<ErrorIssue> {
    // TODO: Implement with updateIssue
    throw new Error('Not implemented');
  }
  assignIssue(issueId: unknown, assigneeId: unknown): Promise<ErrorIssue> {
    // TODO: Implement with assignIssue
    throw new Error('Not implemented');
  }
  muteIssue(issueId: unknown, reason?: unknown): Promise<ErrorIssue> {
    // TODO: Implement with muteIssue
    throw new Error('Not implemented');
  }
  unmuteIssue(issueId: unknown): Promise<ErrorIssue> {
    // TODO: Implement with unmuteIssue
    throw new Error('Not implemented');
  }
  createAlertRule(rule: unknown): Promise<AlertRule> {
    // TODO: Implement with createAlertRule
    throw new Error('Not implemented');
  }
  getAlertRule(ruleId: unknown): Promise<AlertRule> {
    // TODO: Implement with getAlertRule
    throw new Error('Not implemented');
  }
  listAlertRules(options?: unknown): Promise<AlertRule[]> {
    // TODO: Implement with listAlertRules
    throw new Error('Not implemented');
  }
}
