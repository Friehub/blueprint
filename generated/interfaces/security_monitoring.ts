// security_monitoring.ts
// Auto-generated from contracts/security_monitoring.md
// Do not edit manually

export interface Securityevent {
  id: string;
  type: unknown;
  severity: unknown;
  createdAt: Timestamp;
}

export interface Securityalertrule {
  id: string;
  name: unknown;
  conditions: unknown;
  channels: unknown;
  enabled: unknown;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Securitycase {
  id: string;
  subjectRef: unknown;
  status: unknown;
  reason: unknown;
  severity: unknown;
  createdAt: Timestamp;
}

export type Securitycasestatus = SecurityCaseStatus = open | investigating | escalated | resolved | dismissed;

export type Securityeventtype = SecurityEventType = login | password_reset | mfa_challenge | token_revoked | device_trust | suspicious_activity | policy_violation;

export interface SecurityMonitoringContract {
  recordSecurityEvent(event: unknown, context?: unknown): Promise<SecurityEvent>;
  getSecurityEvent(eventId: unknown): Promise<SecurityEvent>;
  listSecurityEvents(input: unknown, options?: unknown): Promise<PaginatedResult<SecurityEvent>>;
  createSecurityAlertRule(rule: unknown): Promise<SecurityAlertRule>;
  getSecurityAlertRule(ruleId: unknown): Promise<SecurityAlertRule>;
  listSecurityAlertRules(options?: unknown): Promise<SecurityAlertRule[]>;
  createSecurityCase(subjectRef: unknown, reason: unknown): Promise<SecurityCase>;
  getSecurityCase(caseId: unknown): Promise<SecurityCase>;
  resolveSecurityCase(caseId: unknown, resolution: unknown): Promise<SecurityCase>;
}
