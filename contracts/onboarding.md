# Module: onboarding

**Version:** 0.1.0
**Part:** I -- Identity and Access

## Purpose

Defines the interface for managing multi-step user onboarding workflows. Onboarding is a bounded, stateful process that guides a newly created user or workspace through a sequence of required and optional steps before they reach an active, fully-functional state. This module owns the onboarding flow definition, step completion tracking, and readiness evaluation. It does not own the steps themselves -- those are delegated to their respective domain modules (e.g., `kyc`, `users`, `billing`).

---

## State Machine

### Flow State
```
PENDING → IN_PROGRESS → COMPLETED
                       → ABANDONED
IN_PROGRESS → BLOCKED   (a required step returns a hard blocker)
BLOCKED → IN_PROGRESS   (blocker resolved externally)
```

### Step State
```
NOT_STARTED → IN_PROGRESS → COMPLETED
                           → SKIPPED      (only if step.required = false)
                           → FAILED
FAILED → IN_PROGRESS       (retry allowed)
```

Transitions:
- `PENDING → IN_PROGRESS`: `startOnboarding` called
- `IN_PROGRESS → COMPLETED`: all required steps reach `COMPLETED`
- `IN_PROGRESS → BLOCKED`: a required step enters `FAILED` with `blockingError = true`
- `BLOCKED → IN_PROGRESS`: `resolveBlock` called after external remediation
- `IN_PROGRESS → ABANDONED`: `abandonOnboarding` called or TTL elapsed

---

## Functions

### `defineFlow(input: FlowDefinition) → OnboardingFlow`
Creates a named, versioned onboarding flow template with an ordered list of steps. Flow definitions are immutable once users are enrolled against them.

### `startOnboarding(input: StartOnboardingInput) → OnboardingSession`
Enrolls a user or workspace into a flow, instantiating all steps in `NOT_STARTED` state. Idempotent -- calling again returns the existing session.

### `getSession(sessionId: OnboardingSessionId) → OnboardingSession`
Returns the full session with all step states and the current readiness evaluation.

### `getSessionBySubject(subjectId: string, flowId: OnboardingFlowId) → OnboardingSession`
Returns the active session for a given subject and flow. Returns `SESSION_NOT_FOUND` if no active session exists.

### `completeStep(input: CompleteStepInput) → OnboardingSession`
Marks a step as `COMPLETED` and evaluates whether the overall session is now `COMPLETED`.

### `skipStep(input: SkipStepInput) → OnboardingSession`
Marks an optional step as `SKIPPED`. Returns `STEP_NOT_SKIPPABLE` if the step is required.

### `failStep(input: FailStepInput) → OnboardingSession`
Records a step failure with a reason. If `blockingError` is true, the session transitions to `BLOCKED`.

### `resolveBlock(sessionId: OnboardingSessionId) → OnboardingSession`
Transitions a `BLOCKED` session back to `IN_PROGRESS`. The previously blocking step is reset to `IN_PROGRESS`.

### `abandonOnboarding(sessionId: OnboardingSessionId) → void`
Marks the session as `ABANDONED`. Emits `onboarding.abandoned`.

### `listSessions(input: ListSessionsInput) → PaginatedList<OnboardingSession>`
Returns sessions filtered by flow, status, or date range.

---

## Types

```typescript
type OnboardingFlowId = string;
type OnboardingSessionId = string;
type OnboardingStepId = string;

type FlowStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "ABANDONED" | "BLOCKED";
type StepStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED" | "FAILED";

type StepDefinition = {
  stepId: OnboardingStepId;
  name: string;
  description?: string;
  required: boolean;
  order: number;
  domainModule: string;            // e.g. "kyc", "billing", "users"
  domainAction: string;            // e.g. "submitKycDocument", "attachPaymentMethod"
  timeoutSeconds?: number;
};

type FlowDefinition = {
  name: string;
  description?: string;
  subjectType: "USER" | "WORKSPACE";
  steps: StepDefinition[];
  ttlSeconds?: number;             // Session TTL before auto-abandon; null = no expiry
};

type OnboardingFlow = FlowDefinition & {
  flowId: OnboardingFlowId;
  version: number;
  createdAt: Timestamp;
};

type OnboardingStepInstance = {
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

type OnboardingSession = {
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

type StartOnboardingInput = {
  flowId: OnboardingFlowId;
  subjectId: string;
  subjectType: "USER" | "WORKSPACE";
  metadata?: Record<string, unknown>;
};

type CompleteStepInput = {
  sessionId: OnboardingSessionId;
  stepId: OnboardingStepId;
  evidence?: Record<string, unknown>;  // Domain-specific completion proof
};

type SkipStepInput = {
  sessionId: OnboardingSessionId;
  stepId: OnboardingStepId;
  reason?: string;
};

type FailStepInput = {
  sessionId: OnboardingSessionId;
  stepId: OnboardingStepId;
  reason: string;
  blockingError?: boolean;
};

type ListSessionsInput = {
  flowId?: OnboardingFlowId;
  status?: FlowStatus;
  subjectType?: "USER" | "WORKSPACE";
  fromDate?: Timestamp;
  toDate?: Timestamp;
  pagination: PaginationInput;
};
```

---

## Invariants

1. A subject may have at most one active (non-`ABANDONED`) session per flow at any time.
2. `completeStep` on a step not in `IN_PROGRESS` or `NOT_STARTED` state is a no-op and returns the current session unchanged.
3. `progressPercent` is computed from required steps only; optional steps do not affect this value.
4. A session cannot transition to `COMPLETED` unless all required steps are in `COMPLETED` state.
5. Flow definitions are versioned; a session pins to the flow version at the time `startOnboarding` is called.
6. `skipStep` on a required step must return `STEP_NOT_SKIPPABLE`; it must never set a required step to `SKIPPED`.
7. TTL enforcement must emit `onboarding.abandoned` with `reason: "TTL_EXPIRED"` before deleting the session record.

---

## Events Emitted

- `onboarding.started`
- `onboarding.step.completed`
- `onboarding.step.skipped`
- `onboarding.step.failed`
- `onboarding.blocked` -- includes `stepId` and `failureReason`
- `onboarding.unblocked`
- `onboarding.completed` -- all required steps done
- `onboarding.abandoned` -- includes `reason` (`USER_INITIATED` | `TTL_EXPIRED`)

---

## System-Level Integrations

- **Idempotency:** `startOnboarding` on `(subjectId, flowId)` is idempotent; returns the existing session.
- **Consistency:** Step state transitions are serialized per session; concurrent `completeStep` calls on the same session must not corrupt step state.
- **Observability:** Each session is a trace; each step completion is a span annotated with `domainModule` and `domainAction`.
- **Dependencies:** `users`, `kyc`, `billing`, `auth` (step domains), `notifications` (progress nudges), `audit_log` (step evidence).
- **Errors:** `FLOW_NOT_FOUND`, `SESSION_NOT_FOUND`, `STEP_NOT_FOUND`, `STEP_NOT_SKIPPABLE`, `SESSION_NOT_BLOCKED`, `DUPLICATE_ACTIVE_SESSION`.
- **Providers (adapter examples):** Custom state machines, Stytch onboarding flows, Chameleon, Appcues (for UI layer integration only; this contract is server-side).
