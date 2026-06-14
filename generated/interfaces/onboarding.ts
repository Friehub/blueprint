// onboarding.ts
// Auto-generated from contracts/onboarding.md
// Do not edit manually

export type OnboardingFlowId = string;

export type OnboardingSessionId = string;

export type OnboardingStepId = string;

export type FlowStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "ABANDONED" | "BLOCKED";

export type StepStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED" | "FAILED";

export type StepDefinition = {
stepId: OnboardingStepId;
name: string;
description?: string;
required: boolean;
order: number;
domainModule: string;            // e.g. "kyc", "billing", "users"
domainAction: string;            // e.g. "submitKycDocument", "attachPaymentMethod"
timeoutSeconds?: number;
};

export type FlowDefinition = {
name: string;
description?: string;
subjectType: "USER" | "WORKSPACE";
steps: StepDefinition[];
ttlSeconds?: number;             // Session TTL before auto-abandon; null = no expiry
};

export type OnboardingFlow = FlowDefinition & {

export type OnboardingStepInstance = {
stepId: OnboardingStepId;
name: string;
required: boolean;
order: number;
status: StepStatus;
startedAt?: Timestamp;
completedAt?: Timestamp;
failureReason?: string;
blockingError?: boolean;
metadata?: Record<string, unknown>;
};

export type OnboardingSession = {
sessionId: OnboardingSessionId;
flowId: OnboardingFlowId;
subjectId: string;
subjectType: "USER" | "WORKSPACE";
status: FlowStatus;
steps: OnboardingStepInstance[];
completedStepCount: number;
requiredStepCount: number;
progressPercent: number;         // completedRequired / totalRequired * 100
startedAt?: Timestamp;
completedAt?: Timestamp;
expiresAt?: Timestamp;
};

export type StartOnboardingInput = {
flowId: OnboardingFlowId;
subjectId: string;
subjectType: "USER" | "WORKSPACE";
metadata?: Record<string, unknown>;
};

export type CompleteStepInput = {
sessionId: OnboardingSessionId;
stepId: OnboardingStepId;
evidence?: Record<string, unknown>;  // Domain-specific completion proof
};

export type SkipStepInput = {
sessionId: OnboardingSessionId;
stepId: OnboardingStepId;
reason?: string;
};

export type FailStepInput = {
sessionId: OnboardingSessionId;
stepId: OnboardingStepId;
reason: string;
blockingError?: boolean;
};

export type ListSessionsInput = {
flowId?: OnboardingFlowId;
status?: FlowStatus;
subjectType?: "USER" | "WORKSPACE";
fromDate?: Timestamp;
toDate?: Timestamp;
pagination: PaginationInput;
};

export interface OnboardingContract {
  defineFlow(input: FlowDefinition): Promise<OnboardingFlow>;
  startOnboarding(input: StartOnboardingInput): Promise<OnboardingSession>;
  getSession(sessionId: OnboardingSessionId): Promise<OnboardingSession>;
  getSessionBySubject(subjectId: string, flowId: OnboardingFlowId): Promise<OnboardingSession>;
  completeStep(input: CompleteStepInput): Promise<OnboardingSession>;
  skipStep(input: SkipStepInput): Promise<OnboardingSession>;
  failStep(input: FailStepInput): Promise<OnboardingSession>;
  resolveBlock(sessionId: OnboardingSessionId): Promise<OnboardingSession>;
  abandonOnboarding(sessionId: OnboardingSessionId): Promise<void>;
  listSessions(input: ListSessionsInput): Promise<PaginatedList<OnboardingSession>>;
}
