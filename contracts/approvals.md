# Module: approvals

**Version:** 0.2.1
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

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Step transitions must be serialized per instance; concurrent `approve` calls on the same step must not double-advance.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for approval lifecycle events.
* **Details:** Duplicate approval events must be idempotent on step and reviewer identity.

### Worker Scaling
* **Policy:** Escalation timer processing, notification dispatch, and workflow query paths must be independently scalable.

### Multi-Region Behavior
* **Mode:** Approval workflows are global; reviewer assignments and decisions must be immediately consistent across regions.
* **Details:** Escalation timers run in the region where the instance was created.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Required Functions:**
  - `submitForApproval(input, idempotency_key?)`
  - `approve(input, idempotency_key?)`
  - `reject(input, idempotency_key?)`
  - `delegate(input, idempotency_key?)`
  - `escalate(escalationId, idempotency_key?)`
  - `withdrawApproval(instanceId, reason?, idempotency_key?)`

### Backpressure
* If escalation timer processing is saturated, overdue steps must be backlogged and processed in priority order; no escalation should be silently dropped.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).
* Domain errors: `WORKFLOW_NOT_FOUND`, `INSTANCE_NOT_FOUND`, `DUPLICATE_ACTIVE_INSTANCE`, `REVIEWER_NOT_ASSIGNED`, `STEP_NOT_AWAITING`, `WITHDRAWAL_NOT_PERMITTED`, `DECISION_ALREADY_RECORDED`, `WORKFLOW_VERSION_MISMATCH`, `STEP_ALREADY_COMPLETED`, `ESCALATION_TIER_EXHAUSTED`.

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
submitForApproval → approval.submitted          { instanceId, workflowId, submittedBy }
step awaiting     → approval.step.awaiting     { instanceId, stepId, assignedReviewers }
step approved     → approval.step.approved      { instanceId, stepId, reviewerId, comment? }
step rejected     → approval.step.rejected      { instanceId, stepId, reviewerId, reason }
step skipped      → approval.step.skipped       { instanceId, stepId }
step delegated    → approval.step.delegated     { instanceId, stepId, delegatingReviewerId, delegateToUserId }
escalation        → approval.escalated          { instanceId, escalationTier }
workflow approved  → approval.approved           { instanceId }
workflow rejected  → approval.rejected           { instanceId }
withdrawn          → approval.withdrawn          { instanceId, reason? }
```

### Temporal Constraints
```
Escalation:
    reviewer_timeout:   configurable per step in EscalationPolicy.afterMinutes
    on_exceed:          escalate to next tier; emit approval.escalated

    escalation_timeout:
        duration:       EscalationPolicy.autoDecisionAfterMinutes
        on_exceed:      apply EscalationPolicy.autoDecision

    auto_decision:
        action:         APPROVE or REJECT per EscalationPolicy
        on_action:      emit approval.step.approved or approval.step.rejected

Workflow instance:
    max_decision_window:  90 days from submission
    on_exceed:            auto-escalate to system admin

Step skip condition:
    evaluation:           at step activation time
    on_satisfied:         step → SKIPPED; next step activates
```

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE approval_workflows (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  description       TEXT,
  subject_type      TEXT NOT NULL,
  version           INTEGER NOT NULL DEFAULT 1,
  allow_withdrawal  BOOLEAN NOT NULL DEFAULT true,
  notify_on_decision BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE approval_workflow_steps (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id       UUID NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  step_order        INTEGER NOT NULL,
  require_all       BOOLEAN NOT NULL DEFAULT false,
  reviewer_type     TEXT NOT NULL DEFAULT 'USER',
  reviewer_ref      TEXT NOT NULL,
  skip_condition    JSONB,
  escalation_policy JSONB,
  instructions      TEXT,
  UNIQUE (workflow_id, step_order)
);

CREATE TABLE approval_instances (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id       UUID NOT NULL REFERENCES approval_workflows(id),
  workflow_version  INTEGER NOT NULL,
  subject_type      TEXT NOT NULL,
  subject_id        TEXT NOT NULL,
  submitted_by      UUID NOT NULL,
  status            TEXT NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'ESCALATED')),
  current_step_index INTEGER NOT NULL DEFAULT 0,
  metadata          JSONB DEFAULT '{}',
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_approval_instances_active_subject ON approval_instances(workflow_id, subject_type, subject_id) WHERE status IN ('PENDING', 'IN_REVIEW', 'ESCALATED');
CREATE INDEX idx_approval_instances_submitter ON approval_instances(submitted_by, submitted_at DESC);
CREATE INDEX idx_approval_instances_status ON approval_instances(status);

CREATE TABLE approval_instance_steps (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id       UUID NOT NULL REFERENCES approval_instances(id) ON DELETE CASCADE,
  workflow_step_id  UUID NOT NULL REFERENCES approval_workflow_steps(id),
  name              TEXT NOT NULL,
  step_order        INTEGER NOT NULL,
  status            TEXT NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING', 'AWAITING', 'APPROVED', 'REJECTED', 'SKIPPED', 'DELEGATED', 'ESCALATED')),
  assigned_reviewers JSONB NOT NULL DEFAULT '[]',
  escalation_tier   INTEGER NOT NULL DEFAULT 0,
  awaiting_since    TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ
);

CREATE INDEX idx_approval_instance_steps_instance ON approval_instance_steps(instance_id, step_order);

CREATE TABLE approval_decisions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_step_id  UUID NOT NULL REFERENCES approval_instance_steps(id) ON DELETE CASCADE,
  reviewer_id       UUID NOT NULL,
  decision          TEXT NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED')),
  comment           TEXT,
  decided_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_approval_decisions_step ON approval_decisions(instance_step_id);
```

### Storage Model
* **Model:** Durable workflow instance store with immutable decision records.
* **Details:** Workflow definitions are versioned; instances pin to the definition version at submission. Step transitions are serialized via row-level locking. Decisions are append-only per step.

### Observability
* **Tracing Spans:** Each workflow instance is a trace root; each step decision is an annotated span. Span attributes include `instanceId`, `workflowId`, `stepId`, and `decision`. Every function call follows `approvals.<function>`.
* **Telemetry Metrics:**
```
blueprint_approvals_operation_total              counter { function, result }
blueprint_approvals_operation_duration_ms        histogram { function }
blueprint_approvals_errors_total                 counter { function, error_code }
blueprint_approvals_instances_total               counter { status }
blueprint_approvals_instance_duration_ms          histogram { workflow_id }
blueprint_approvals_step_duration_ms              histogram { step_order }
blueprint_approvals_escalations_total             counter { escalation_tier }
blueprint_approvals_auto_decisions_total          counter { decision }
```
* **SLO Targets:** Decision recording P99 ≤ 100ms; instance query P99 ≤ 200ms; escalation timer accuracy ≤ 10 seconds.

### Module Dependencies
* **Depends On:** notifications, jobs, users, permissions, audit_log
* **Emits To:** events
* **Recommends:** analytics (approval metrics), reporting (compliance reports)

### Breaking Change Policy
- Adding new step status values or escalation actions is additive and backward-compatible.
- Removing or renaming an existing status value requires a MAJOR version bump.
- Changing the escalation policy evaluation order requires a MAJOR version bump.
- Adding new required fields to `WorkflowDefinition` requires a MAJOR version bump.
- Adding a new `ReviewerAssignment` type is additive and backward-compatible.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Double-advance on concurrent approve | Race condition on step transition | Row-level lock on step row; verify status before transition |
| Escalation timer lost | Worker crash before timer fires | Recover on restart; scan for overdue escalations |
| Reviewer assigned to deleted user | User hard-deleted after workflow definition | Fall back to group/role resolution; flag for admin |
| Skip condition evaluation failure | Malformed skip condition | Skip is not evaluated; step proceeds normally; log error |
| Instance orphaned without decision | All reviewers leave org | Auto-escalate to escalation tier; notify admin |
