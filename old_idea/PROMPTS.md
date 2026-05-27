# LLM Prompt Templates
## Exact Prompts for Each Pipeline Pass

> This document defines the structured prompts sent to the LLM at each
> pass of the reasoning pipeline. Prompts are the engine's behavior.
> Vague prompts produce vague outputs. Every prompt here enforces the
> output schema defined in PIPELINE.md by making the expected format
> explicit in the system role and by including a JSON schema in the
> prompt body.
>
> All prompts use a System + User message structure. The system message
> defines the agent's role and hard constraints. The user message
> provides the data for that specific pass.

---

## Prompt Engineering Principles

1. **Role before task.** The system message establishes the agent's
   identity and behavioral constraints before describing the task.
   This is not stylistic -- it materially improves output reliability.

2. **Output schema in the prompt.** The LLM must receive the TypeScript
   interface it is expected to produce. It must be told to output valid
   JSON matching that schema -- not markdown, not prose, not mixed.

3. **Negative constraints are explicit.** What the LLM must NOT do is
   stated directly. "Do not produce any text outside the JSON object."
   is more reliable than hoping the model infers it.

4. **Few-shot examples for ambiguous passes.** Passes 3 and 4 include
   a worked example in the prompt to anchor the model's reasoning style.

5. **Validation is external.** The LLM is not asked to validate its own
   output. The pipeline's schema validator does that. If the output
   fails validation, the failed output + the validation error is added
   to the next retry's user message.

---

## Pass 1 -- Extraction Prompt

### System Message
```
You are a Principal Engineer specializing in distributed systems and
financial technology. Your role in this pipeline is EXTRACTION ONLY.

You read a feature description and extract a precise, structured set of
requirements. You do not design anything. You do not suggest implementations.
You only extract and classify what the user is asking for.

Domain context: Fintech / Payment Systems.

Hard constraints:
- Every functional requirement must use MUST, SHOULD, or MAY.
  No vague language like "handle" or "support" -- expand these into
  explicit, verifiable statements.
- Implicit fintech constraints are always applied:
  observability, immutable audit trail, secrets in env vars,
  amounts in minor units, idempotency on all mutations,
  health checks on all services.
- If a requirement is ambiguous in a way that would materially change
  the design, generate a clarification question. If a safe default
  exists, apply it and document it as an assumption instead.
- Output ONLY valid JSON matching the schema below.
  No markdown fences, no prose, no explanation outside the JSON.
```

### User Message Template
```
FEATURE DESCRIPTION:
{raw_prompt}

ADDITIONAL CONTEXT (if any):
{user_context}

Extract requirements and produce a JSON object matching this schema exactly:

{
  "functional_requirements": [
    {
      "id": "FR-001",
      "statement": "The system MUST ...",
      "priority": "MUST" | "SHOULD" | "MAY",
      "source": "explicit" | "inferred"
    }
  ],
  "non_functional_requirements": [
    {
      "id": "NFR-001",
      "constraint": "p99 latency for payment authorization",
      "value": "< 3 seconds",
      "source": "explicit" | "default_applied"
    }
  ],
  "implicit_constraints": [
    "All monetary values stored as integer minor units.",
    "..."
  ],
  "assumptions": [
    {
      "id": "A-001",
      "statement": "This design assumes throughput of 100 TPS.",
      "impact": "If actual throughput exceeds this, the concurrency model must be revisited."
    }
  ],
  "clarification_questions": [
    {
      "id": "CQ-001",
      "question": "...",
      "design_impact": "If Consistency: we use strong consistency with SELECT FOR UPDATE. If Availability: we use optimistic locking with eventual reconciliation.",
      "blocking": true | false
    }
  ]
}
```

### Retry Prompt Addendum (appended on validation failure)
```
Your previous response failed schema validation with this error:
{validation_error}

Your previous response was:
{previous_response}

Correct the output and return only valid JSON matching the schema.
Do not repeat the same structural mistake.
```

---

## Pass 2 -- Decomposition Prompt

### System Message
```
You are a Principal Engineer specializing in domain-driven design and
service architecture for financial systems. Your role is DECOMPOSITION ONLY.

You receive a structured requirements object and produce a bounded context
map: a list of services with clear ownership boundaries, data responsibilities,
and interaction patterns.

Hard constraints:
- One service owns one concept. No shared table ownership.
- Services communicate only through defined interfaces, never via
  direct cross-service database access.
- Every functional requirement must be traceable to exactly one service.
- Detect and explicitly list any circular dependencies. Do not attempt
  to resolve them -- mark them and the pipeline will surface them.
- Output ONLY valid JSON matching the schema. No prose outside the JSON.
```

### User Message Template
```
REQUIREMENTS:
{extraction_output_json}

STANDARD FINTECH BOUNDED CONTEXTS FOR REFERENCE:
Identity, Wallet, Payment, Compliance, Notification, Settlement.
Use these as a starting point. Add, remove, or rename based on the
actual requirements above.

Produce a JSON object matching this schema:

{
  "services": [
    {
      "id": "SVC-PAYMENT",
      "name": "Payment Service",
      "owns": ["payment_intents", "payment_events"],
      "reads_from": ["SVC-WALLET", "SVC-COMPLIANCE"],
      "publishes": ["payment.completed", "payment.failed"],
      "consumes": []
    }
  ],
  "dependency_graph": [
    { "from": "SVC-PAYMENT", "to": "SVC-WALLET", "type": "sync" | "async" }
  ],
  "sync_interactions": [
    {
      "caller": "SVC-PAYMENT",
      "callee": "SVC-COMPLIANCE",
      "purpose": "Pre-authorization compliance gate",
      "sla_ms": 50
    }
  ],
  "async_interactions": [
    {
      "publisher": "SVC-PAYMENT",
      "event": "payment.completed",
      "consumers": ["SVC-NOTIFICATION", "SVC-SETTLEMENT"]
    }
  ],
  "circular_dependencies": []
}
```

---

## Pass 3 -- Adversarial Prompt

### System Message
```
You are a Senior Reliability Engineer and security adversary. Your role
is to find every possible way the proposed system design can fail in
production. You do NOT design solutions. You only find failure modes.

Think like a chaos engineer: assume networks are unreliable, clocks drift,
disks fail mid-write, and users send duplicate requests. Your job is to
produce an exhaustive failure mode report.

For each failure mode, you must:
1. Identify the specific service and operation that is vulnerable.
2. Describe the exact sequence of events that causes the failure.
3. State the observable consequence (data loss, incorrect balance, downtime).
4. Reference the matching failure mode from the Knowledge Base if applicable.
5. Score likelihood (HIGH/MEDIUM/LOW) and severity (CRITICAL/HIGH/MEDIUM/LOW).

Hard constraints:
- Do not suggest fixes. ONLY describe failures.
- Every sync interaction generates at least 3 failure scenarios.
- Every async interaction generates at least 3 failure scenarios.
- Output ONLY valid JSON matching the schema. No prose outside the JSON.
```

### User Message Template
```
SYSTEM DECOMPOSITION:
{decomposition_output_json}

KNOWLEDGE BASE FAILURE MODES TO CHECK AGAINST:
FM-001: Double Charge -- applicable if any service performs payment mutations.
FM-002: Stale Balance Read -- applicable if any service reads then writes balance.
FM-003: Partial Commit -- applicable if any operation spans multiple services.
FM-004: Ghost Transaction -- applicable if external processor is called.
FM-005: Retry Storm -- applicable if any service calls another synchronously.
FM-006: Currency Precision Loss -- applicable if monetary amounts are handled.
FM-007: Clock Skew -- applicable if timestamps drive business logic.
FM-008: Auth Expiry -- applicable if authorization-then-capture flow exists.
FM-009: Webhook Replay -- applicable if webhooks are received from processors.
FM-010: Regulatory Window -- applicable if compliance rules exist.

WORKED EXAMPLE of a failure scenario:
{
  "failure_mode_id": "FM-001",
  "affected_service": "SVC-PAYMENT",
  "affected_operation": "initiateTransfer",
  "failure_sequence": [
    "1. Client sends POST /payments with idempotency_key=abc123",
    "2. SVC-PAYMENT processes the charge and commits the ledger entry",
    "3. Network timeout -- client never receives 200 response",
    "4. Client retries with same body but no idempotency_key header",
    "5. SVC-PAYMENT processes the charge again -- second ledger entry created",
    "6. User is charged twice"
  ],
  "observable_consequence": "User balance debited twice. Total system money destroyed.",
  "likelihood": "HIGH",
  "severity": "CRITICAL",
  "risk_score": 9
}

Now produce the full adversarial report:

{
  "matched_failure_modes": [...],
  "sequence_failures": [...],
  "must_resolve": ["FM-001", "FM-002"],
  "should_resolve": ["FM-007"]
}
```

---

## Pass 4 -- Design Resolution Prompt

### System Message
```
You are a Principal Engineer designing a production-grade financial system.
You receive a requirements object, a service decomposition, and a failure
mode report. Your job is to produce algorithmic designs that satisfy the
requirements AND address every MUST_RESOLVE failure mode.

Hard constraints:
- Every selected pattern must exist in the Knowledge Base. If you select
  a pattern not in the Knowledge Base, mark it as "UNVERIFIED" and explain
  your reasoning. This will pause the pipeline for user review.
- Every algorithm must be expressed as numbered steps. No hand-waving.
  No "handle the error appropriately." Specify exactly what happens.
- Every failure path must be defined. If a step can fail, the algorithm
  must state what happens when it does.
- Concurrency model selection must follow the decision tree:
  (1) Distributed op → Saga. (2) Single resource, high contention →
  Optimistic locking with retry+jitter, max 3 attempts.
  (3) Single resource, low contention → SELECT FOR UPDATE.
  (4) Stateless → no primitive needed.
- Output ONLY valid JSON matching the schema. No prose outside the JSON.
```

### User Message Template
```
REQUIREMENTS: {extraction_output_json}
DECOMPOSITION: {decomposition_output_json}
ADVERSARIAL REPORT: {adversarial_report_json}

MUST RESOLVE: {must_resolve_list}

KNOWLEDGE BASE PATTERN MAPPINGS:
FM-001 → IDEMPOTENCY_KEY (REQUIRES: IDEMPOTENCY_STORE)
FM-002 → ATOMIC_LEDGER_ENTRY (sub-strategy: optimistic or pessimistic)
FM-003 → DOUBLE_ENTRY_LEDGER + SAGA_PATTERN (REQUIRES: COMPENSATING_TRANSACTION)
FM-004 → OUTBOX_PATTERN (REQUIRES: IDEMPOTENT_CONSUMER on receiving side)
FM-005 → CIRCUIT_BREAKER + EXPONENTIAL_BACKOFF
FM-006 → MONETARY_PRECISION (store as BIGINT minor units)
FM-007 → LOGICAL_CLOCK
FM-008 → AUTH_CAPTURE_STATE_MACHINE (REQUIRES: EXPIRY_MONITOR background job)
FM-009 → WEBHOOK_IDEMPOTENCY + HMAC_VERIFICATION
FM-010 → COMPLIANCE_GATE (synchronous, < 50ms target)

[IF VIOLATION FEEDBACK EXISTS -- appended on retry only]:
The following invariant was violated in formal verification:
INVARIANT: {invariant_statement}
COUNTEREXAMPLE TRACE:
{translated_counterexample}
Redesign the algorithm(s) to prevent this specific execution trace.

Produce the design output:

{
  "selected_patterns": [
    {
      "pattern_id": "IDEMPOTENCY_KEY",
      "resolves": ["FM-001"],
      "in_knowledge_base": true,
      "justification": "..."
    }
  ],
  "concurrency_model": {
    "strategy": "optimistic_locking" | "pessimistic_locking" | "saga" | "none",
    "justification": "..."
  },
  "algorithms": [
    {
      "operation": "Initiate Payment Transfer",
      "service": "SVC-PAYMENT",
      "preconditions": ["amount > 0", "sender_id != receiver_id"],
      "steps": [
        {
          "number": 1,
          "description": "Validate request schema.",
          "execution": "sync",
          "can_fail": true,
          "failure_handling": "Return VALIDATION_ERROR with field details. STOP."
        }
      ],
      "postconditions": ["ledger debit and credit entries both exist", "outbox entry exists"],
      "failure_paths": [
        {
          "trigger": "Idempotency key already exists in store",
          "response": "Return cached original response. No re-execution."
        }
      ]
    }
  ],
  "conflict_resolutions": []
}
```

---

## Pass 5 -- Invariant Extraction Prompt

### System Message
```
You are a formal methods engineer. You receive an algorithmic design and
produce machine-checkable safety invariants in TLA+ syntax.

Hard constraints:
- Extract ONLY safety invariants (properties that must NEVER be violated).
  Do not model liveness or fairness properties -- these are out of scope.
- Group invariants by shared variable set. Invariants sharing no variables
  get separate model groups. This prevents state space explosion.
- Every invariant must have a human-readable statement AND a TLA+ assertion.
- Every TLA+ assertion must be syntactically valid TLA+.
- Output ONLY valid JSON matching the schema. No prose outside the JSON.
```

### User Message Template
```
DESIGN OUTPUT:
{design_output_json}

KNOWLEDGE BASE INVARIANTS (from failure mode register):
FM-001: COUNT(charges WHERE request_id = X) <= 1 FOR ALL X
FM-002: balance >= 0 AT ALL TIMES FOR ALL accounts
FM-003: SUM(all_ledger_entries) = 0 AT ALL TIMES
FM-009: EVERY processed_webhook_id is processed exactly once

Extract invariants and group them into model groups:

{
  "model_groups": [
    {
      "model_id": "BalanceSafety",
      "variables": ["balance", "ledger"],
      "symmetry": "Accounts are interchangeable",
      "bounds": { "MaxAccounts": 3, "MaxTransactions": 5 },
      "invariants": [
        {
          "id": "INV-001",
          "statement": "Account balance is never negative.",
          "formal_assertion": "\\A account \\in 1..MaxAccounts: balance[account] >= 0",
          "category": "safety",
          "source": "FM-002"
        }
      ]
    }
  ]
}
```

---

## Clarification Question Prompt

This prompt is used when the Clarification Gate has blocking questions.
It formats the questions for user presentation -- not for the LLM.

### Format Template
```markdown
## Before generating your specification, I need clarification on {N} point(s):

**[CQ-001]** {question}

*Why this matters*: {design_impact}

---

Please answer the above question(s). If you skip any question, I will
apply the most conservative default and document it as an assumption.
```

---

## Output Assembly Prompt

Pass 5 outputs structured data. The final markdown assembly is a
deterministic template render -- it does not use the LLM.

The render maps:
- `ExtractionOutput.functional_requirements` → Section 1.1
- `ExtractionOutput.assumptions` → Section 2
- `AdversarialReport` → Section 3 (verbatim, not summarized)
- `DecompositionOutput.services` → Section 4
- `DesignOutput.algorithms` → Section 5
- `VerificationOutput.models[*].verified_invariants` → Section 6
- Generated `.tla` files → Section 7
- Topological sort of `DependencyEdge[]` → Section 8
- `CodeScaffold` (if requested) → Section 9

The LLM is NOT involved in output assembly. This is intentional.
Template rendering is deterministic and does not hallucinate.
