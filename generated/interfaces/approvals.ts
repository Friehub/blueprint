// approvals.ts
// Auto-generated from contracts/approvals.md
// Do not edit manually

export type ApprovalWorkflowId = string;

export type WorkflowInstanceId = string;

export type WorkflowStepId = string;

export type EscalationId = string;

export type WorkflowStatus = "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "ESCALATED";

export type StepStatus = "PENDING" | "AWAITING" | "APPROVED" | "REJECTED" | "SKIPPED" | "DELEGATED" | "ESCALATED";

export type ReviewerAssignment = {
type: "USER" | "ROLE" | "GROUP";
ref: string;                       // UserId, role name, or group identifier
};

export type EscalationPolicy = {
afterMinutes: number;
escalateTo: ReviewerAssignment[];
autoDecision?: "APPROVE" | "REJECT"; // Decision if escalation itself times out
autoDecisionAfterMinutes?: number;
};

export type SkipCondition = {
field: string;                     // Subject metadata field to evaluate
operator: "eq" | "gt" | "lt" | "in";
value: unknown;
};

export type StepDefinition = {
stepId: WorkflowStepId;
name: string;
order: number;
reviewers: ReviewerAssignment[];
requireAll: boolean;               // true = all reviewers must approve; false = any one suffices
skipCondition?: SkipCondition;
escalation?: EscalationPolicy;
instructions?: string;
};

export type WorkflowDefinition = {
name: string;
description?: string;
subjectType: string;               // e.g. "expense_report", "access_request", "purchase_order"
steps: StepDefinition[];
allowWithdrawal: boolean;
notifyOnDecision: boolean;
};

export type ApprovalWorkflow = WorkflowDefinition & {

export type SubjectRef = {
subjectType: string;
subjectId: string;
};

export type Decision = {
reviewerId: UserId;
decision: "APPROVED" | "REJECTED";
comment?: string;
decidedAt: Timestamp;
};

export type WorkflowStepInstance = {
stepId: WorkflowStepId;
name: string;
order: number;
status: StepStatus;
assignedReviewers: ReviewerAssignment[];
decisions: Decision[];
delegatedTo?: UserId;
escalationTier: number;
awaitingSince?: Timestamp;
completedAt?: Timestamp;
};

export type WorkflowInstance = {
instanceId: WorkflowInstanceId;
workflowId: ApprovalWorkflowId;
subjectRef: SubjectRef;
submittedBy: UserId;
status: WorkflowStatus;
steps: WorkflowStepInstance[];
currentStepIndex: number;
submittedAt: Timestamp;
completedAt?: Timestamp;
metadata?: Record<string, unknown>;
};

export type SubmitForApprovalInput = {
workflowId: ApprovalWorkflowId;
subjectRef: SubjectRef;
submittedBy: UserId;
metadata?: Record<string, unknown>;
};

export type ApprovalDecisionInput = {
instanceId: WorkflowInstanceId;
reviewerId: UserId;
comment?: string;
};

export type RejectionDecisionInput = ApprovalDecisionInput & {

export type DelegateInput = {
instanceId: WorkflowInstanceId;
delegatingReviewerId: UserId;
delegateToUserId: UserId;
reason?: string;
};

export type ListInstancesInput = {
workflowId?: ApprovalWorkflowId;
status?: WorkflowStatus;
submittedBy?: UserId;
reviewerId?: UserId;
subjectType?: string;
pagination: PaginationInput;
};

export interface ApprovalsContract {
  defineWorkflow(input: WorkflowDefinition): Promise<ApprovalWorkflow>;
  submitForApproval(input: SubmitForApprovalInput): Promise<WorkflowInstance>;
  getInstance(instanceId: WorkflowInstanceId): Promise<WorkflowInstance>;
  getInstanceBySubject(subjectRef: SubjectRef): Promise<WorkflowInstance>;
  approve(input: ApprovalDecisionInput): Promise<WorkflowInstance>;
  reject(input: RejectionDecisionInput): Promise<WorkflowInstance>;
  delegate(input: DelegateInput): Promise<WorkflowInstance>;
  escalate(escalationId: EscalationId): Promise<WorkflowInstance>;
  withdrawApproval(instanceId: WorkflowInstanceId, reason?: string): Promise<void>;
  listInstances(input: ListInstancesInput): Promise<PaginatedList<WorkflowInstance>>;
  getPendingReviews(reviewerId: UserId): Promise<PaginatedList<WorkflowStepInstance>>;
}
