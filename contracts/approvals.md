# Module: approvals

**Version:** 0.1.0
**Part:** IX -- Workflows

## Purpose

Defines the interface for managing multi-step approval workflows. An approval workflow is a structured decision chain in which a subject (a document, expense report, access request, or any domain entity) must receive explicit sign-off from one or more designated reviewers before a downstream action is permitted. This module owns the workflow template, step assignment, reviewer decisions, and escalation. It does not own the subject entity itself -- the subject is identified by reference and owned by its originating domain module.

---

## State Machine

### Workflow Instance State
```
PENDING → IN_REVIEW → APPROVED
                    → REJECTED
                    → WITHDRAWN
IN_REVIEW → ESCALATED → IN_REVIEW   (escalation resolved)
                      → APPROVED    (auto-approve on escalation timeout)
                      → REJECTED    (auto-reject on escalation timeout)
```

### Step State
```
PENDING → AWAITING → APPROVED
                   → REJECTED
                   → SKIPPED    (conditional skip rule satisfied)
AWAITING → DELEGATED → APPROVED
                     → REJECTED
AWAITING → ESCALATED → APPROVED
                     → REJECTED
```

Transitions:
- `PENDING → IN_REVIEW`: first step becomes `AWAITING`; notification sent to first reviewer(s)
- Step `APPROVED` and more steps remain: next step becomes `AWAITING`
- All required steps `APPROVED`: workflow transitions to `APPROVED`
- Any required step `REJECTED`: workflow transitions to `REJECTED` immediately
- `IN_REVIEW → WITHDRAWN`: `withdrawApproval` called by the submitter

---

## Functions

### `defineWorkflow(input: WorkflowDefinition) → ApprovalWorkflow`
Creates a named, versioned approval workflow template. Defines the ordered steps, reviewer assignment rules, and escalation policies.

### `submitForApproval(input: SubmitForApprovalInput) → WorkflowInstance`
Creates a workflow instance for a specific subject entity. Immediately transitions to `IN_REVIEW` and notifies the first step's reviewers.

### `getInstance(instanceId: WorkflowInstanceId) → WorkflowInstance`
Returns the full workflow instance including all step states and decision history.

### `getInstanceBySubject(subjectRef: SubjectRef) → WorkflowInstance`
Returns the active workflow instance for a subject. Returns `INSTANCE_NOT_FOUND` if no active instance exists.

### `approve(input: ApprovalDecisionInput) → WorkflowInstance`
Records an approval decision for the current step. If the step has `requireAll = true`, the step only advances when all assigned reviewers have approved.

### `reject(input: RejectionDecisionInput) → WorkflowInstance`
Records a rejection decision. The workflow immediately transitions to `REJECTED`.

### `delegate(input: DelegateInput) → WorkflowInstance`
Assigns the current step to a different reviewer. The original reviewer is no longer required to act. Only valid while the step is `AWAITING`.

### `escalate(escalationId: EscalationId) → WorkflowInstance`
Manually escalates the workflow to the next escalation tier. Typically called by a jobs module on timeout.

### `withdrawApproval(instanceId: WorkflowInstanceId, reason?: string) → void`
Withdraws the approval request. Only valid while the workflow is `IN_REVIEW` or `ESCALATED`. The submitter must be the caller.

### `listInstances(input: ListInstancesInput) → PaginatedList<WorkflowInstance>`
Returns instances filtered by workflow, status, submitter, or reviewer.

### `getPendingReviews(reviewerId: UserId) → PaginatedList<WorkflowStepInstance>`
Returns all steps currently awaiting action from a specific reviewer across all workflows.

---

## Types

```typescript
type ApprovalWorkflowId = string;
type WorkflowInstanceId = string;
type WorkflowStepId = string;
type EscalationId = string;

type WorkflowStatus = "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "ESCALATED";
type StepStatus = "PENDING" | "AWAITING" | "APPROVED" | "REJECTED" | "SKIPPED" | "DELEGATED" | "ESCALATED";

type ReviewerAssignment = {
  type: "USER" | "ROLE" | "GROUP";
  ref: string;                       // UserId, role name, or group identifier
};

type EscalationPolicy = {
  afterMinutes: number;
  escalateTo: ReviewerAssignment[];
  autoDecision?: "APPROVE" | "REJECT"; // Decision if escalation itself times out
  autoDecisionAfterMinutes?: number;
};

type SkipCondition = {
  field: string;                     // Subject metadata field to evaluate
  operator: "eq" | "gt" | "lt" | "in";
  value: unknown;
};

type StepDefinition = {
  stepId: WorkflowStepId;
  name: string;
  order: number;
  reviewers: ReviewerAssignment[];
  requireAll: boolean;               // true = all reviewers must approve; false = any one suffices
  skipCondition?: SkipCondition;
  escalation?: EscalationPolicy;
  instructions?: string;
};

type WorkflowDefinition = {
  name: string;
  description?: string;
  subjectType: string;               // e.g. "expense_report", "access_request", "purchase_order"
  steps: StepDefinition[];
  allowWithdrawal: boolean;
  notifyOnDecision: boolean;
};

type ApprovalWorkflow = WorkflowDefinition & {
  workflowId: ApprovalWorkflowId;
  version: number;
  createdAt: Timestamp;
};

type SubjectRef = {
  subjectType: string;
  subjectId: string;
};

type Decision = {
  reviewerId: UserId;
  decision: "APPROVED" | "REJECTED";
  comment?: string;
  decidedAt: Timestamp;
};

type WorkflowStepInstance = {
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

type WorkflowInstance = {
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

type SubmitForApprovalInput = {
  workflowId: ApprovalWorkflowId;
  subjectRef: SubjectRef;
  submittedBy: UserId;
  metadata?: Record<string, unknown>;
};

type ApprovalDecisionInput = {
  instanceId: WorkflowInstanceId;
  reviewerId: UserId;
  comment?: string;
};

type RejectionDecisionInput = ApprovalDecisionInput & {
  reason: string;
};

type DelegateInput = {
  instanceId: WorkflowInstanceId;
  delegatingReviewerId: UserId;
  delegateToUserId: UserId;
  reason?: string;
};

type ListInstancesInput = {
  workflowId?: ApprovalWorkflowId;
  status?: WorkflowStatus;
  submittedBy?: UserId;
  reviewerId?: UserId;
  subjectType?: string;
  pagination: PaginationInput;
};
```

---

## Invariants

1. A subject may have at most one active (non-`APPROVED`, non-`REJECTED`, non-`WITHDRAWN`) workflow instance per workflow definition at any time.
2. `approve` from a reviewer not assigned to the current step must return `REVIEWER_NOT_ASSIGNED`.
3. A step with `requireAll = true` advances only when every assigned reviewer (including delegated reviewers) has recorded an `APPROVED` decision.
4. `reject` by any single assigned reviewer immediately terminates the workflow as `REJECTED`, regardless of `requireAll`.
5. Workflow definitions are versioned; a workflow instance pins to the definition version at `submitForApproval` time.
6. `withdrawApproval` is only callable by the original submitter; it is not available if the workflow is already `APPROVED`, `REJECTED`, or `WITHDRAWN`.
7. `skipCondition` is evaluated once at the time a step would transition to `AWAITING`; if satisfied, the step transitions to `SKIPPED` and the next step begins.
8. Escalation timers must be managed by the `jobs` module; this module does not own timer scheduling.

---

## Events Emitted

- `approval.submitted`
- `approval.step.awaiting` -- includes assigned reviewers and step name
- `approval.step.approved` -- includes `reviewerId` and `comment`
- `approval.step.rejected` -- includes `reviewerId` and `reason`
- `approval.step.skipped`
- `approval.step.delegated`
- `approval.escalated` -- includes `escalationTier`
- `approval.approved` -- full workflow approved
- `approval.rejected` -- full workflow rejected
- `approval.withdrawn`

---

## System-Level Integrations

- **Idempotency:** `submitForApproval` is idempotent on `(workflowId, subjectRef)`; a duplicate call returns the existing active instance.
- **Consistency:** Step transitions must be serialized per instance; concurrent `approve` calls on the same step must not double-advance.
- **Observability:** Each workflow instance is a trace root; each step decision is an annotated span.
- **Dependencies:** `notifications` (reviewer alerts), `jobs` (escalation timers), `users` (reviewer identity resolution), `permissions` (role/group membership for `ReviewerAssignment`), `audit_log` (immutable decision record).
- **Errors:** `WORKFLOW_NOT_FOUND`, `INSTANCE_NOT_FOUND`, `DUPLICATE_ACTIVE_INSTANCE`, `REVIEWER_NOT_ASSIGNED`, `STEP_NOT_AWAITING`, `WITHDRAWAL_NOT_PERMITTED`, `DECISION_ALREADY_RECORDED`.
- **Providers (adapter examples):** Custom implementation, Temporal workflows, AWS Step Functions, Camunda, Prefect (for data pipeline approvals).
