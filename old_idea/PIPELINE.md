# Reasoning Pipeline Specification
## How a Prompt Becomes a Verified Engineering Specification

> This document defines the exact execution logic of the Engineering
> Blueprinting Platform. Every pass, every schema, every validation rule,
> and every edge case is specified here before implementation begins.
> This document IS the engine's source of truth.

---

## Overview

A prompt enters the pipeline and is transformed through 5 sequential passes.
Each pass has a strict input contract, a processing algorithm, and an output
contract. If a pass produces output that violates its output contract, it
retries (up to 3 times) before failing with an explicit error.

```
[INPUT: Raw Prompt]
        ↓
  ┌─────────────────────────────────────────────────────────────┐
  │  PASS 1: EXTRACTION                                         │
  │  Extract requirements, constraints, and assumptions.        │
  └─────────────────────────────────────────────────────────────┘
        ↓
  ┌─────────────────────────────────────────────────────────────┐
  │  CLARIFICATION GATE                                         │
  │  If ambiguities exist: pause and ask. Else: continue.       │
  └─────────────────────────────────────────────────────────────┘
        ↓
  ┌─────────────────────────────────────────────────────────────┐
  │  PASS 2: DECOMPOSITION                                      │
  │  Break into services. Define ownership and data boundaries. │
  └─────────────────────────────────────────────────────────────┘
        ↓
  ┌─────────────────────────────────────────────────────────────┐
  │  PASS 3: ADVERSARIAL STRESS TEST                            │
  │  Match the design against the Failure Mode Register.        │
  └─────────────────────────────────────────────────────────────┘
        ↓
  ┌─────────────────────────────────────────────────────────────┐
  │  PASS 4: DESIGN RESOLUTION                                  │
  │  Produce algorithmic designs that survive the adversary.    │
  └─────────────────────────────────────────────────────────────┘
        ↓
  ┌─────────────────────────────────────────────────────────────┐
  │  PASS 5: INVARIANT EXTRACTION + FORMAL VERIFICATION         │
  │  Extract invariants. Generate TLA+ model. Run TLC checker.  │
  │  If violation found → return to PASS 4.                     │
  └─────────────────────────────────────────────────────────────┘
        ↓
  ┌─────────────────────────────────────────────────────────────┐
  │  OUTPUT ASSEMBLY                                            │
  │  Render final markdown specification.                       │
  └─────────────────────────────────────────────────────────────┘
        ↓
[OUTPUT: Verified .spec.md + .tla formal model]
```

---

## Pass 1 -- Extraction

### Purpose
Transform the raw user prompt into a structured requirements object. Surface
all explicit requirements, infer all implicit constraints, and identify all
ambiguities that would cause a materially different design if resolved
differently.

### Input Schema
```typescript
interface ExtractionInput {
  raw_prompt: string;
  domain: "fintech"; // locked for this domain
  user_context?: string; // optional additional context the user provides
}
```

### Processing Algorithm

**Step 1.1 -- Functional Requirement Extraction**

Scan the prompt for explicit actions the system must perform. Each action
becomes a `FunctionalRequirement`. The format is:
`"The system MUST [verb] [object] [condition?]"`

Every requirement must use `MUST` (non-negotiable), `SHOULD` (recommended),
or `MAY` (optional). No vague language permitted. If the prompt says "handle
payments," this is expanded to explicit requirements:
- "The system MUST accept payment initiation requests."
- "The system MUST authorize payment with a third-party processor."
- "The system MUST record the outcome of every authorization attempt."

**Step 1.2 -- Non-Functional Requirement Extraction**

Extract explicit performance constraints. If not provided, apply domain
defaults and document them as assumptions:

| Constraint | Default if not specified |
|------------|--------------------------|
| Throughput | 100 transactions/second |
| p99 latency (payment auth) | < 3 seconds |
| Availability | 99.9% (three nines) |
| Data durability | 99.999999% (eight nines) |
| Consistency model | Strong (not configurable for payment balances) |

**Step 1.3 -- Implicit Constraint Injection**

Apply all fintech implicit constraints from KNOWLEDGE_BASE.md Part 4
automatically. These are never surfaced as questions.

**Step 1.4 -- Completeness Check (The Clarification Gate Pre-processor)**

Run the following checks. Each failure produces a candidate clarification
question:

| Check | Failure Condition | Question Template |
|-------|-------------------|-------------------|
| Scale clarity | Throughput not specified or too vague | "What is the expected peak transaction volume (per second)?" |
| Consistency boundary | CAP trade-off not addressed | "Do you prioritize Consistency or Availability during a network partition?" |
| Currency scope | Multi-currency implied but not confirmed | "Does this system need to support multiple currencies?" |
| Regulatory context | Geography not mentioned | "In which regulatory jurisdiction(s) will this system operate?" |
| Auth model | Who initiates payments is unclear | "Are payments initiated by users, merchants, or the system automatically?" |

**Priority filter**: Only ask questions where the answer will change the
design in Pass 2, 3, or 4. If a default can be safely applied, apply it
and document it as an assumption. Do NOT ask.

### Output Schema
```typescript
interface ExtractionOutput {
  functional_requirements: FunctionalRequirement[];
  non_functional_requirements: NFRRequirement[];
  implicit_constraints: string[]; // from Knowledge Base Part 4
  assumptions: Assumption[];      // defaults applied without asking
  clarification_questions: ClarificationQuestion[]; // may be empty
}

interface FunctionalRequirement {
  id: string;           // e.g., "FR-001"
  statement: string;    // "The system MUST..."
  priority: "MUST" | "SHOULD" | "MAY";
  source: "explicit" | "inferred"; // was this in the prompt or derived?
}

interface Assumption {
  id: string;           // e.g., "A-001"
  statement: string;    // "This design assumes throughput of 100 TPS."
  impact: string;       // "If actual throughput exceeds this, the concurrency
                        //  model in Pass 4 must be revisited."
}

interface ClarificationQuestion {
  id: string;           // e.g., "CQ-001"
  question: string;
  design_impact: string; // Exactly what changes if answered differently.
  blocking: boolean;     // true = pipeline cannot continue without answer
}
```

### Validation Rules
- Every functional requirement must contain an explicit verb (MUST/SHOULD/MAY).
- Assumptions list must not be empty. At minimum, scale defaults are assumed.
- If `clarification_questions` contains any item where `blocking = true`,
  the pipeline pauses at the Clarification Gate.

### Retry Behavior
If output schema validation fails: retry the extraction pass with the
original prompt plus the validation error as context. Max 3 retries.
On third failure: surface a "Pipeline Error" to the user with the raw
LLM output for manual inspection.

---

## The Clarification Gate

### Purpose
The single point of human intervention in the pipeline (unless the tool
determines no questions are needed).

### Logic
```
IF clarification_questions is empty:
    → Skip gate. Proceed to Pass 2 immediately.
ELSE IF all questions have blocking = false:
    → Surface questions as "Optional Refinements."
    → User may answer or skip. Pipeline proceeds after 60 seconds
      regardless (unanswered questions use defaults).
ELSE (at least one blocking question):
    → Surface blocking questions only. Pause pipeline.
    → Pipeline resumes ONLY after user provides answers.
    → Non-blocking questions are answered with defaults and documented.
```

### Clarification Response Processing
When the user answers clarification questions:
1. Update the `ExtractionOutput` with the new information.
2. Re-run the Completeness Check to ensure no new gaps were introduced.
3. If new blocking questions emerge: present them.
4. If no new questions: proceed to Pass 2.

**Hard rule**: The pipeline never shows the same question twice. If the
user's answer is ambiguous, the pipeline applies the most conservative
interpretation and documents it.

---

## Pass 2 -- Decomposition

### Purpose
Break the system into bounded contexts. Assign data ownership. Define
service interfaces. Detect and flag circular dependencies before the
design phase.

### Input
`ExtractionOutput` (from Pass 1, after clarification gate).

### Processing Algorithm

**Step 2.1 -- Bounded Context Identification**

Group functional requirements into cohesive bounded contexts. Each context
becomes a candidate service. Rules:
- One context owns one concept. No shared ownership.
- If two requirements modify the same data, they belong to the same context.
- A context communicates with another only through defined interfaces,
  never through direct database access.

For the fintech domain, the standard bounded contexts are:

| Context | Owns | Interface |
|---------|------|-----------|
| Identity | Users, authentication, sessions | REST: /auth |
| Wallet | Account balances, ledger entries | Internal gRPC or direct DB |
| Payment | Payment intent, authorization, capture | REST: /payments + webhooks |
| Compliance | Rules, velocity checks, sanctions | Internal sync call |
| Notification | Alerts, receipts, confirmations | Event consumer (async) |
| Settlement | Batch reconciliation, payout | Scheduled job + internal API |

**Step 2.2 -- Data Responsibility Assignment**

For each context, define:
- Which tables it owns exclusively.
- Which data it reads from other contexts (read-only, via API or event).
- Which events it publishes.
- Which events it consumes.

**Step 2.3 -- Circular Dependency Detection**

Build the dependency graph. If Service A calls Service B, which calls
Service A (directly or transitively), this is a circular dependency.
The pipeline must:
1. Flag the cycle.
2. Propose a resolution (usually: extract the shared concern into a
   third service, or invert the dependency via an event).
3. Require the circular dependency to be resolved before Pass 3.

**Step 2.4 -- Sync vs Async Classification**

For every inter-service interaction:
- **Synchronous** if: the calling service needs the result to continue.
  (e.g., Compliance check must complete before Payment authorizes.)
- **Asynchronous** if: the calling service does not need the result
  immediately. (e.g., Notification is sent after Payment completes.)

This classification directly feeds Pass 4's algorithm design.

### Output Schema
```typescript
interface DecompositionOutput {
  services: Service[];
  dependency_graph: DependencyEdge[];
  sync_interactions: Interaction[];
  async_interactions: Interaction[];
  circular_dependencies: CircularDependency[]; // Must be empty to proceed
}

interface Service {
  id: string;           // e.g., "SVC-PAYMENT"
  name: string;
  owns: string[];       // table names or data entities
  reads_from: string[]; // other service IDs it reads from
  publishes: string[];  // event names
  consumes: string[];   // event names
}
```

### Validation Rules
- `circular_dependencies` must be empty to proceed to Pass 3.
- Every functional requirement from Pass 1 must be traceable to exactly
  one service in the decomposition.
- No service reads directly from another service's owned tables.

---

## Pass 3 -- Adversarial Stress Test

### Purpose
This pass has ONE job: find ways the proposed decomposition will fail in
production. It does not design solutions. It produces a `FailureModeReport`.
The design happens in Pass 4, informed by this report.

### Input
`DecompositionOutput` (from Pass 2).

### Processing Algorithm

**Step 3.1 -- Automatic Failure Mode Matching**

Cross-reference the decomposition against KNOWLEDGE_BASE.md Part 1.
For every service in the decomposition:

1. Check if the service performs any state-changing operations (writes).
   If yes: FM-001 (Double Charge) and FM-002 (Stale Balance Read) are
   applicable.
2. Check if the service communicates with an external processor.
   If yes: FM-004 (Ghost Transaction) and FM-009 (Webhook Replay) are
   applicable.
3. Check if any operation spans multiple services.
   If yes: FM-003 (Partial Commit) is applicable.
4. Check if any service calls another synchronously.
   If yes: FM-005 (Retry Storm) is applicable.
5. Check if monetary amounts are handled.
   If yes: FM-006 (Currency Precision Loss) is applicable.
6. Check if payments involve authorization-then-capture flow.
   If yes: FM-008 (Silent Authorization Expiry) is applicable.
7. Check if timestamps are used for business logic.
   If yes: FM-007 (Clock Skew) is applicable.
8. Check if compliance rules are defined.
   If yes: FM-010 (Regulatory Window Violation) is applicable.

**Step 3.2 -- Sequence Diagram Failure Injection**

For every synchronous interaction identified in Pass 2, generate three
failure scenarios:
1. **Timeout**: The called service does not respond within the SLA.
2. **Error Response**: The called service returns 5xx.
3. **Partial Success**: The called service completes partially (e.g., DB
   write succeeds, response transmission fails).

For every asynchronous interaction, generate:
1. **Message Loss**: The event is never delivered to the consumer.
2. **Message Duplication**: The consumer receives the event twice.
3. **Out-of-Order Delivery**: Events arrive in wrong sequence.

**Step 3.3 -- Severity Scoring**

Each identified failure mode is scored:
- `likelihood`: Based on the system's architecture (HIGH if no mitigations
  exist, MEDIUM if partial mitigations exist, LOW if fully mitigated).
- `severity`: From the Knowledge Base (CRITICAL/HIGH/MEDIUM/LOW).
- `risk_score`: `likelihood_weight × severity_weight`

The top 5 by risk_score are marked `MUST_RESOLVE` in Pass 4.

### Output Schema
```typescript
interface AdversarialReport {
  matched_failure_modes: MatchedFailureMode[];
  sequence_failures: SequenceFailure[];
  must_resolve: string[];   // failure mode IDs that block Pass 4 progress
  should_resolve: string[]; // failure mode IDs that are recommended
}

interface MatchedFailureMode {
  failure_mode_id: string;  // e.g., "FM-001"
  affected_service: string; // e.g., "SVC-PAYMENT"
  likelihood: "LOW" | "MEDIUM" | "HIGH";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  risk_score: number;
}
```

### Validation Rules
- If ANY `CRITICAL` severity failure mode is matched with `HIGH` likelihood,
  it is automatically `MUST_RESOLVE`. Pass 4 cannot output a design that
  does not address it.
- The adversarial report is appended to the final spec verbatim, including
  failure modes that were addressed. It is not hidden from the user.

---

## Pass 4 -- Design Resolution

### Purpose
Produce the algorithmic engineering design that satisfies the requirements
from Pass 1, survives the failure modes identified in Pass 3, and uses only
patterns validated against the Knowledge Base.

### Input
`ExtractionOutput` + `DecompositionOutput` + `AdversarialReport`

### Processing Algorithm

**Step 4.1 -- Pattern Selection per Failure Mode**

For each `MUST_RESOLVE` failure mode, select the required mitigation from
the Knowledge Base. The selection is not free-form -- the engine picks from
the `SOLVES` edges in the graph:

```
FM-001 → SOLVES: IDEMPOTENCY_KEY → REQUIRES: IDEMPOTENCY_STORE
FM-002 → SOLVES: ATOMIC_LEDGER_ENTRY → SELECT sub-strategy (see below)
FM-003 → SOLVES: DOUBLE_ENTRY_LEDGER + SAGA_PATTERN
FM-004 → SOLVES: OUTBOX_PATTERN → REQUIRES: IDEMPOTENT_CONSUMER
FM-005 → SOLVES: CIRCUIT_BREAKER + EXPONENTIAL_BACKOFF
FM-006 → SOLVES: MONETARY_PRECISION
FM-007 → SOLVES: LOGICAL_CLOCK
FM-008 → SOLVES: AUTH_CAPTURE_STATE_MACHINE
FM-009 → SOLVES: WEBHOOK_IDEMPOTENCY + HMAC_VERIFICATION
FM-010 → SOLVES: COMPLIANCE_GATE
```

When a pattern `REQUIRES` another pattern, that requirement is also added
to the design automatically. When a pattern `INTRODUCES` a new problem,
that new problem is added to the adversarial report and a solution is
selected.

**Step 4.2 -- Concurrency Model Selection**

Using the Decision Tree from BLUEPRINT.md Section 7:

1. If the operation spans multiple services: Saga (not 2PC unless we own all).
2. If the operation is on a single shared resource with high contention
   (e.g., a single account balance under high load):
   → Use Optimistic Locking with retry.
3. If the operation is on a single shared resource with low contention:
   → Use SELECT FOR UPDATE.
4. If the operation is stateless: no concurrency primitive needed.

The selected concurrency model must be justified in the output.

**Step 4.3 -- Algorithmic Step Definition**

For each core operation (e.g., "Initiate Payment Transfer"), define the
algorithm as explicit numbered steps. No hand-waving. No "handle errors here."

**Example: Initiate Payment Transfer**
```
1. Validate request schema (amount > 0, valid currency, valid account IDs).
2. Verify idempotency_key is not in idempotency_store.
   IF found: return cached response. STOP.
3. Run COMPLIANCE_GATE synchronously.
   IF blocked: return COMPLIANCE_REJECTED with reason code. STOP.
4. BEGIN DATABASE TRANSACTION (SERIALIZABLE isolation).
5.   SELECT balance FROM accounts WHERE id = sender_id FOR UPDATE.
6.   ASSERT balance >= amount. IF NOT: ROLLBACK. Return INSUFFICIENT_FUNDS.
7.   INSERT INTO ledger_entries (debit entry for sender).
8.   INSERT INTO ledger_entries (credit entry for receiver).
9.   INSERT INTO outbox (payment.completed event).
10.  INSERT INTO idempotency_store (key, response).
11. COMMIT TRANSACTION.
12. Return SUCCESS with transaction_id.
13. [Async] Outbox relay publishes payment.completed to event bus.
14. [Async] Notification service consumes event, sends receipt.
```

Every step is numbered. Every failure case is handled. Every async step
is explicitly labeled as async.

**Step 4.4 -- Conflict Check**

Before finalizing the design, run the Conflict Matrix from KNOWLEDGE_BASE.md
Part 3. If any two selected patterns appear as conflicting, the engine must:
1. Surface the conflict explicitly.
2. Apply the resolution column from the matrix.
3. Re-run Step 4.1 with the resolved pattern set.

### Output Schema
```typescript
interface DesignOutput {
  selected_patterns: SelectedPattern[];
  concurrency_model: ConcurrencyModel;
  algorithms: Algorithm[];
  conflict_resolutions: ConflictResolution[];
}

interface Algorithm {
  operation: string;    // e.g., "Initiate Payment Transfer"
  service: string;      // e.g., "SVC-PAYMENT"
  preconditions: string[];
  steps: AlgorithmStep[];
  postconditions: string[];
  failure_paths: FailurePath[];
}

interface AlgorithmStep {
  number: number;
  description: string;
  execution: "sync" | "async";
  can_fail: boolean;
  failure_handling?: string;
}
```

### Validation Rules
- Every `MUST_RESOLVE` failure mode from Pass 3 must map to at least one
  `selected_pattern` in the output.
- Every selected pattern must exist in the Knowledge Base. Unknown patterns
  are flagged as "Unverified Design Recommendation" and block final output.
- Every algorithm must have at least one `failure_path` defined.

---

## Pass 5 -- Invariant Extraction + Formal Verification

### Purpose
Extract machine-checkable invariants from the design and verify them using
a formal model checker. Each invariant is verified in its own isolated,
minimal model -- never in a single monolithic model. This is the architectural
decision that prevents state space explosion from making formal verification
practically useless.

### Why Decomposed Models, Not One Large Model

A monolithic TLA+ model covering all invariants simultaneously grows
exponentially: N accounts × M transaction states × P retry states × Q
outbox states = combinatorial explosion. A 120-second timeout on that
model is not a solution -- it is a gamble that the violating state is
reachable early. It often is not.

The correct approach:
- **One model per invariant category.** Each model only models the variables
  and state transitions relevant to its invariant.
- **Symmetry declarations.** If "all accounts are interchangeable" for a
  given invariant, TLC reduces N! account orderings to 1.
- **Explicit bounds as constants.** State space bounds are constants in the
  TLA+ spec (`CONSTANTS MaxAccounts = 3`), not time-based cutoffs.
  If TLC exhausts the bounded state space and finds no violation, the
  invariant is verified for that bound. The bound is documented.

### Input
`DesignOutput` (from Pass 4).

### Processing Algorithm

**Step 5.1 -- Invariant Extraction**

From the algorithmic designs and selected patterns, extract all invariants.
Each invariant comes from one of three sources:
1. **Knowledge Base invariants**: The formal assertions defined in each
   failure mode in Part 1 of the Knowledge Base.
2. **Design-derived invariants**: Logical consequences of the algorithm
   (e.g., "If step 11 commits, step 7 and step 8 both succeeded.").
3. **User-stated invariants**: Explicit rules the user provided in the prompt.

Each invariant is categorized:
- **Safety**: Something that must NEVER happen (e.g., `balance < 0`).
- **Liveness**: Something that MUST EVENTUALLY happen.
- **Fairness**: Behavioral properties.

For MVP: Only **Safety** invariants are formally verified.
Liveness and Fairness are documented with their logical justification
but are not model-checked. This is an explicit, documented limitation --
not a silent fallback.

**Step 5.2 -- Invariant Decomposition into Model Groups**

Group Safety invariants by their shared variable set. Invariants that
share no variables are verified in completely independent models.
Invariants that share variables are grouped into one model.

For the fintech domain, the standard decomposition is:

| Model | Invariants Verified | Variables Modeled | Symmetry |
|-------|--------------------|--------------------|----------|
| `BalanceSafety.tla` | `balance >= 0`, `SUM(ledger) = 0` | `balance`, `ledger` | Accounts are symmetric |
| `Idempotency.tla` | `COUNT(charges per key) <= 1` | `idempotency_store`, `ledger` | Keys are symmetric |
| `StateMachine.tla` | Valid payment state transitions only | `payment_status` | Payments are symmetric |
| `OutboxAtomicity.tla` | `outbox entry exists IFF tx committed` | `outbox`, `ledger`, `db_state` | None (order matters) |

**Step 5.3 -- TLA+ Model Generation Per Group**

Each model group generates a separate `.tla` file. The model structure:

```tla
---- MODULE BalanceSafety ----
EXTENDS Naturals, FiniteSets

(* Explicit bounds -- not a timeout, a verified scope. *)
CONSTANTS MaxAccounts,   \ Symmetry: Accounts == 1..MaxAccounts
          MaxTransactions \ Bound: at most N transactions per run

SYMMETRY Permutations(1..MaxAccounts) (* Reduces N! to 1 *)

VARIABLES balance, ledger

TypeInvariant ==
  /\ balance \in [1..MaxAccounts -> Nat]
  /\ \A e \in ledger: e.amount \in Nat /\ e.amount > 0

(* The safety invariant this model verifies: *)
BalanceNonNegative ==
  \A account \in 1..MaxAccounts: balance[account] >= 0

LedgerConservation ==
  LET debits  == {e \in ledger: e.direction = "D"}
      credits == {e \in ledger: e.direction = "C"}
  IN  SumAmounts(debits) = SumAmounts(credits)

SafetyInvariant == BalanceNonNegative /\ LedgerConservation
====
```

TLC configuration per model:
```cfg
(* BalanceSafety.cfg *)
CONSTANT MaxAccounts = 3
CONSTANT MaxTransactions = 5
INVARIANT SafetyInvariant
INVARIANT TypeInvariant
```

With symmetry reduction and these bounds, TLC exhausts the full state
space for this model in seconds, not minutes.

**Step 5.4 -- Parallel Verification Execution**

All model groups run in parallel (not sequentially). The pipeline does
not wait for one to finish before starting the next.

```
FOR EACH model_group IN model_groups:
    SPAWN: run_tlc(model_group.tla, model_group.cfg)

AWAIT ALL processes

FOR EACH result IN results:
    IF result.status == VIOLATED:
        → Capture violated invariant + full counterexample trace
        → Mark for Pass 4 feedback
    IF result.status == VERIFIED:
        → Mark invariant as formally verified with bound documentation
    IF result.status == ERROR (TLC process failure, not timeout):
        → Mark invariant as "Verification tool unavailable"
        → Surface explicit warning to user
        → Do NOT silently proceed
```

**There is no timeout cutoff.** TLC either finishes (verified or
counterexample found) or fails (process error). The bounds in the `.cfg`
file ensure TLC always terminates. If the bounds need to be larger, we
update the constants -- we do not set a wall clock timer and hope.

**Step 5.5 -- Violation Feedback Loop**

If any model reports a violation:
1. Extract the full counterexample trace from TLC output.
2. Translate the trace back to English:
   - `"State 1: account_1.balance = 100, account_2.balance = 50"`
   - `"State 2: debit(account_1, 60) committed"`
   - `"State 3: credit(account_2, 60) NOT in ledger -- balance destroyed"`
3. Feed this trace (not just the invariant) back to Pass 4.
4. Re-run Pass 4 with the trace as a hard constraint.
5. After Pass 4 produces a new design, re-run only the violated model.
6. Maximum 3 feedback iterations per model.
7. If still violated after 3: surface as "Unresolvable Design Conflict."
   Include the full trace for manual architectural review.

### Output Schema
```typescript
interface VerificationOutput {
  models: ModelResult[];       // One entry per model group
  overall_status: "VERIFIED" | "VIOLATED" | "PARTIALLY_VERIFIED" | "ERROR";
  // PARTIALLY_VERIFIED: some models verified, others had tool errors
}

interface ModelResult {
  model_id: string;            // e.g., "BalanceSafety"
  tla_source_path: string;     // path to generated .tla file
  cfg_path: string;            // path to generated .cfg file
  verified_invariants: Invariant[];
  status: "VERIFIED" | "VIOLATED" | "ERROR";
  verification_bounds: Record<string, number>; // e.g., {MaxAccounts: 3}
  counterexample_trace?: string; // TLC output on violation
  duration_ms: number;
}

interface Invariant {
  id: string;               // e.g., "INV-001"
  statement: string;        // human-readable
  formal_assertion: string; // TLA+ expression
  category: "safety" | "liveness" | "fairness";
  verified: boolean;
  verification_bound?: string; // e.g., "Verified for MaxAccounts=3, MaxTx=5"
  source: string;           // e.g., "FM-001" or "FR-003"
}
```

### Validation Rules
- `overall_status = VERIFIED` requires ALL models to have `status = VERIFIED`.
- A model with `status = ERROR` (tool failure) sets overall to `PARTIALLY_VERIFIED`
  and surfaces an explicit warning. It does NOT silently pass.
- The verification bounds for every verified invariant are included in
  the final spec. Users must see what scope was verified.

---

## Output Assembly

### Purpose
Assemble all pass outputs into a single, structured markdown specification
following the fixed heading schema defined in BLUEPRINT.md Decision 3.

### The Final Spec Structure

```markdown
# [System Name] -- Engineering Specification
> Generated by Engineering Blueprinter | Fintech Domain
> Formal Verification: VERIFIED | [date]

## 1. Requirements
### 1.1 Functional Requirements
### 1.2 Non-Functional Requirements
### 1.3 Implicit Constraints (Auto-Applied)
## 2. Assumptions
## 3. Failure Mode Register
> [from Pass 3 AdversarialReport -- verbatim, not summarized]
## 4. Domain Decomposition
> [from Pass 2 -- service map, ownership, sync/async interactions]
## 5. Algorithms
> [from Pass 4 -- numbered step-by-step for each core operation]
## 6. Invariants
> [from Pass 5 -- all invariants, verification status per invariant]
## 7. Formal Model
> [TLA+ source, TLC verification output]
## 8. Implementation Order
> [derived from dependency graph -- what to build first]
## 9. Code Scaffold (Optional)
> [only if requested -- stubs only, no logic]
```

### Implementation Order Derivation

The build order is derived from the dependency graph:
1. Shared infrastructure first (database schema, idempotency store).
2. Services with no dependencies.
3. Services whose dependencies are already built.
4. Integration layer last.

This order is topologically sorted from the `DependencyEdge[]` graph in
`DecompositionOutput`. It is never a manual judgment call.

---

## Pipeline Error Handling

| Error Type | Behavior |
|------------|----------|
| Pass produces invalid output schema | Retry up to 3 times with error context appended |
| Knowledge Base pattern not found | Flag as "Unverified Recommendation," pause for user acknowledgment |
| Circular dependency detected | Block Pass 3. Surface resolution options to user. |
| Formal invariant violated after 3 redesigns | Surface "Unresolvable Conflict" with trace to user |
| TLC model checker process failure | Fall back to documenting invariants as "Unverified (tool unavailable)" |
| Clarification question unanswered after timeout | Apply most conservative default, document assumption |

---

## Performance Constraints on the Pipeline Itself

The pipeline must complete within predictable time bounds:

| Pass | Target Duration | Basis |
|------|----------------|-------|
| Pass 1 (Extraction) | < 30 seconds | LLM inference |
| Clarification Gate | Async (user-dependent) | -- |
| Pass 2 (Decomposition) | < 60 seconds | LLM inference |
| Pass 3 (Adversarial) | < 45 seconds | Knowledge Base lookup + LLM |
| Pass 4 (Design) | < 90 seconds | LLM inference |
| Pass 5 (Formal Verification) | < 60 seconds | Parallel TLC on bounded models |
| Output Assembly | < 15 seconds | Template rendering |
| **Total (no clarification)** | **< 5 minutes** | |

Pass 5 targets < 60 seconds because models run in parallel and each
individual model is bounded to a small, symmetric state space. TLC on
a model with `MaxAccounts = 3` and symmetry reduction typically completes
in under 5 seconds. The 60-second budget covers up to 12 models running
sequentially on a single core, or proportionally fewer on multi-core.

**There is no timeout fallback.** If a model runs longer than expected,
it indicates the state space bounds in the `.cfg` were set too large.
The fix is to tighten the bounds, not to terminate TLC and pretend the
invariant was verified.
