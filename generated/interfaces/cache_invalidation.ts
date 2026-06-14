// cache_invalidation.ts
// Auto-generated from contracts/cache_invalidation.md
// Do not edit manually

export type InvalidationRuleId = string;

export type InvalidationJobId = string;

export type RuleStatus = "ACTIVE" | "DISABLED";

export type JobStatus = "TRIGGERED" | "PROCESSING" | "COMPLETED" | "PARTIALLY_COMPLETED" | "FAILED";

export type KeyPattern = {
pattern: string;                 // Cache key pattern with variable interpolation, e.g. "user:{event.data.userId}:*"
cacheStore?: string;             // Target cache store name; null = default store
};

export type EventFilter = {
eventName: string;               // Exact event name, e.g. "order.status_changed"
sourceModule?: string;           // Optional filter to prevent cross-module collision
payloadConditions?: {
field: string;
operator: "eq" | "in" | "exists";
value?: unknown;
}[];
};

export type CreateRuleInput = {
name: string;
description?: string;
eventFilter: EventFilter;
keyPatterns: KeyPattern[];
priority?: number;               // Higher priority rules execute first when multiple rules match
maxRetries?: number;             // Retry count for failed key purges; defaults to 3
};

export type UpdateRuleInput = {
ruleId: InvalidationRuleId;
name?: string;
description?: string;
keyPatterns?: KeyPattern[];
maxRetries?: number;
};

export type InvalidationRule = {
ruleId: InvalidationRuleId;
name: string;
description?: string;
eventFilter: EventFilter;
keyPatterns: KeyPattern[];
priority: number;
maxRetries: number;
status: RuleStatus;
totalTriggeredCount: number;
lastTriggeredAt?: Timestamp;
createdAt: Timestamp;
updatedAt: Timestamp;
};

export type TriggerInvalidationInput = {
ruleId: InvalidationRuleId;
eventPayload: Record<string, unknown>;  // Used for pattern interpolation
triggeredBy?: UserId;
};

export type InvalidationJob = {
jobId: InvalidationJobId;
ruleId: InvalidationRuleId;
status: JobStatus;
resolvedKeyPatterns: string[];   // Patterns after variable interpolation
purgedKeys: string[];
failedKeys: string[];
triggeredAt: Timestamp;
completedAt?: Timestamp;
errorMessage?: string;
};

export type ListRulesInput = {
sourceModule?: string;
eventName?: string;
status?: RuleStatus;
pagination: PaginationInput;
};

export type ListJobsInput = {
ruleId?: InvalidationRuleId;
status?: JobStatus;
fromDate?: Timestamp;
toDate?: Timestamp;
pagination: PaginationInput;
};

export interface CacheInvalidationContract {
  createRule(input: CreateRuleInput): Promise<InvalidationRule>;
  getRule(ruleId: InvalidationRuleId): Promise<InvalidationRule>;
  listRules(input: ListRulesInput): Promise<PaginatedList<InvalidationRule>>;
  updateRule(input: UpdateRuleInput): Promise<InvalidationRule>;
  disableRule(ruleId: InvalidationRuleId): Promise<InvalidationRule>;
  enableRule(ruleId: InvalidationRuleId): Promise<InvalidationRule>;
  deleteRule(ruleId: InvalidationRuleId): Promise<void>;
  triggerInvalidation(input: TriggerInvalidationInput): Promise<InvalidationJob>;
  getJob(jobId: InvalidationJobId): Promise<InvalidationJob>;
  listJobs(input: ListJobsInput): Promise<PaginatedList<InvalidationJob>>;
  previewInvalidation(input: TriggerInvalidationInput): Promise<string[]>;
}
