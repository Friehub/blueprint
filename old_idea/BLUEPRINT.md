# Engineering Blueprinting Platform
## System Specification: How to Build It

> This document is written the way the tool itself would write a spec.
> It treats building the Blueprinter as the "Feature Request" and applies
> the same reasoning rigor the product will use on its users' prompts.

---

## 1. The Problem Statement (First Principles)

### What Actually Goes Wrong When Engineers Skip Design

The gap between "prompt" and "production-safe code" is not a syntax problem.
It is a **semantic reasoning problem**. The following are the three categories
of failures this tool must eliminate before code is written:

**Category A — Concurrency Failures (Race Conditions)**
- Two users buy the last item at the same millisecond.
- A payment is deducted, and the confirmation request times out. The client
  retries. The payment is deducted twice.
- A distributed cache and a database go out of sync during a write. Reads
  return stale data silently.

**Category B — State Corruption Failures**
- A background worker processes a job. The job partially completes. The
  service crashes. On restart, the job is retried from scratch, duplicating
  side effects (emails sent twice, inventory decremented twice).
- A state machine transitions from PENDING → SHIPPED without going through
  PAID. There is no guard. The bug is silent until a refund is attempted.

**Category C — Failure Semantics Failures (Invisible Bugs)**
- A third-party API times out. The code throws. No retry logic exists. The
  user sees a 500. The operation is lost silently.
- A database transaction rolls back. The event that was published before the
  rollback is not rolled back. The event consumer acts on data that no longer
  exists.

**The Core Insight**: These failures are not caused by bad code. They are
caused by the absence of a **system model** before code is written. The
Blueprinting Platform forces that model to exist before a single function
is defined.

---

## 2. What the Platform Must Produce

For any input prompt, the platform must output the following layers.
Each layer must be a direct dependency of the layer below it.

```
[1] Requirements
      ↓
[2] Domain Decomposition
      ↓
[3] System Topology
      ↓
[4] Algorithmic Design (The Core)
      ↓
[5] Invariants & Correctness Rules
      ↓
[6] Failure Mode Analysis
      ↓
[7] Data & Event Model
      ↓
[8] Concurrency Model
      ↓
[9] Implementation Order
      ↓
[10] (Optional) Code Scaffold
```

---

## 3. The Reasoning Pipeline Architecture

The product is NOT an LLM wrapper. It is a **multi-pass reasoning engine**
where each pass has a specific, constrained job.

### Pass 1 — Extraction (The "What")
- **Input**: Raw user prompt.
- **Job**: Extract explicit and implicit requirements.
- **Edge Case**: Ambiguous prompts (e.g., "build a wallet") must trigger a
  clarification protocol before reasoning begins, NOT after. If the tool
  reasons on an ambiguous prompt, the output is confidently wrong.
- **Output**: A structured `Requirements` object with:
  - `functional[]`: What the system must do.
  - `non_functional[]`: Latency/throughput/availability targets.
  - `implicit_constraints[]`: Things the user didn't say but obviously need
    (e.g., "build a payment system" implies "no double charge").

### Pass 2 — Decomposition (The "Who Owns What")
- **Input**: Requirements object.
- **Job**: Break the system into bounded contexts. Define ownership.
- **Edge Case**: Circular ownership (Service A depends on Service B, which
  depends on Service A for data). This must be detected and flagged as an
  architectural smell before proceeding.
- **Output**: A dependency-ordered list of services with their data
  responsibilities and external interfaces.

### Pass 3 — Adversarial Stress Test (The "What Could Kill This")
- **Input**: Domain decomposition.
- **Job**: Enumerate failure scenarios. This pass must be SEPARATE from the
  design pass. If design and adversarial reasoning happen in the same pass,
  the adversary is too "polite."
- **Algorithm**:
  1. For every state transition, ask: "What if the network dies HERE?"
  2. For every external call, ask: "What if this returns 503?"
  3. For every write, ask: "What if this is replayed?"
  4. For every read, ask: "Is this data stale? Does it matter?"
- **Output**: A `Failure Mode Register` — an ordered list of failure
  scenarios ranked by likelihood × severity.

### Pass 4 — Design Resolution (The "How")
- **Input**: Requirements + Failure Mode Register.
- **Job**: Produce algorithmic designs that satisfy requirements AND handle
  all listed failure modes.
- **Critical Constraint**: The design must choose ONE concurrency model and
  justify it. The system must not mix "optimistic locking in the service" with
  "pessimistic locking in the DB" without explicit justification, as this
  creates undefined behavior under high concurrency.
- **Output**: Step-by-step algorithmic descriptions of each core operation.

### Pass 5 — Invariant Extraction (The "What Must Never Break")
- **Input**: Algorithmic design.
- **Job**: Derive machine-checkable invariants from the design.
- **Format**: Each invariant must be expressible as a logical assertion.
  - BAD: "The wallet should not go negative."
  - GOOD: `ASSERT: balance_after_tx = balance_before_tx - amount WHERE amount <= balance_before_tx`
- **Edge Case**: Invariants that cannot be expressed as logical assertions are
  vague requirements disguised as invariants. These must be sent back to the
  user for clarification.

---

## 4. The Knowledge Base (Engineering Primitives Graph)

The reasoning engine needs a structured knowledge base of distributed systems
patterns. This is NOT a vector database of documentation. It is a
**graph of trade-offs**.

### Node Types
- **Consistency Patterns**: Strong Consistency, Eventual Consistency,
  Read-Your-Writes, Causal Consistency.
- **Concurrency Primitives**: Optimistic Locking, Pessimistic Locking,
  CRDTs, Actor Model, CSP.
- **Reliability Patterns**: Saga, 2PC, Outbox Pattern, Dead Letter Queue,
  Circuit Breaker, Bulkhead.
- **Data Patterns**: CQRS, Event Sourcing, Snapshot Pattern.

### Edge Types (The Trade-offs)
- `REQUIRES`: Optimistic Locking REQUIRES version numbers on every row.
- `CONFLICTS_WITH`: Strong Consistency CONFLICTS_WITH High Availability
  (CAP Theorem).
- `SOLVES`: Outbox Pattern SOLVES the "Event published before commit" failure.
- `INTRODUCES`: Saga Pattern INTRODUCES the need for Compensating Transactions.

### Why This Matters
When the engine picks "Saga Pattern" for checkout, it MUST automatically pull
in "Compensating Transactions" as a required design element. Without the
graph, the engine will recommend Sagas without defining what happens on
failure — which is exactly the problem we are solving.

---

## 5. Failure Modes of the Platform Itself

The platform must reason correctly about its own failure modes.

### Edge Case 1 — The Hallucinated Protocol
**Problem**: The LLM invents a concurrency strategy that sounds correct but
is subtly broken (e.g., "use Redis INCR for idempotency" without addressing
Redis eviction policy causing key loss).
**Mitigation**: Every recommended pattern must be validated against the
Knowledge Base graph. If the pattern is not in the graph, the engine must
flag it as "Unverified Design Recommendation" and require explicit user
acknowledgment.

### Edge Case 2 — The Incomplete Prompt
**Problem**: The user says "build a checkout system" with no scale requirements.
The engine produces a design for 100 requests/second. The user needs 100,000.
**Mitigation**: Non-functional requirements (throughput, latency, availability)
must be explicitly confirmed or estimated before design begins. If not
provided, the engine must state its assumptions clearly and design for them.

### Edge Case 3 — The Conflicting Requirements
**Problem**: The user wants "real-time consistency" AND "globally distributed
with no single point of failure." These conflict at the CAP Theorem boundary.
**Mitigation**: The engine must surface this conflict BEFORE designing,
present the trade-off explicitly, and require the user to make a conscious
choice. It must never silently pick one side.

### Edge Case 4 — The Overfit Design
**Problem**: The engine produces a design so complex (e.g., full Event
Sourcing + CQRS + Saga) for a system that only needs a simple CRUD API.
**Mitigation**: Each recommended pattern must include a "Justification Score"
based on the extracted requirements. Complexity is only added if the failure
mode it solves is in the Failure Mode Register.

### Edge Case 5 — The Stale Specification
**Problem**: Requirements change after the spec is produced, but the
implementation plan is no longer consistent with the new requirements.
**Mitigation**: Specs must be versioned. Any change to a requirement must
trigger a delta analysis that identifies which downstream sections of the spec
are now invalid.

---

## 6. The Data Model for a Specification

A generated specification must be stored as a **structured object**, not raw
markdown. This allows it to be diffed, versioned, and validated.

```typescript
interface Specification {
  id: string;
  version: number;
  prompt: string;
  assumptions: string[];
  requirements: {
    functional: Requirement[];
    non_functional: NFRRequirement[];
    implicit_constraints: Constraint[];
  };
  failure_mode_register: FailureMode[];
  domain_map: Service[];
  algorithms: Algorithm[];
  invariants: Invariant[];
  concurrency_model: ConcurrencyModel;
  data_model: DataModel;
  event_model: EventModel;
  implementation_order: Phase[];
  scaffold?: CodeScaffold;
}

interface FailureMode {
  scenario: string;
  likelihood: "LOW" | "MEDIUM" | "HIGH";
  severity: "LOW" | "MEDIUM" | "CRITICAL";
  resolution: string;
  pattern_used: string; // references a node in the Knowledge Base graph
}

interface Invariant {
  id: string;
  assertion: string; // machine-readable logical assertion
  category: "safety" | "liveness" | "fairness";
  verified: boolean; // true if validated by simulation
}
```

---

## 7. The Concurrency Model Decision Tree

The platform must follow a strict decision tree when choosing a concurrency
strategy, not pick one arbitrarily.

```
Is the operation distributed across multiple services?
├── YES → Is atomicity required across all services?
│         ├── YES → Saga with Compensating Transactions
│         │         (Do NOT use 2PC unless you control all services)
│         └── NO  → Eventual Consistency with Idempotent Operations
└── NO  → Is the operation on a single shared resource?
          ├── YES → Is contention expected to be high?
          │         ├── YES → Optimistic Locking (with retry + jitter)
          │         └── NO  → Pessimistic Locking or DB Serializable Tx
          └── NO  → Stateless. No concurrency primitive needed.
```

This tree is deterministic. The engine must be able to explain WHY it picked
a strategy, not just what strategy it picked.

---

## 8. Implementation Phases (Build Order for the Platform Itself)

### Phase 1 — The Knowledge Base
Build the Engineering Primitives Graph first. Without it, the reasoning
engine has no ground truth to validate against.
- Define ~50 core patterns with their trade-off edges.
- Store as a graph database (or an in-memory graph for MVP).
- Write unit tests that verify the graph is consistent (no circular
  REQUIRES edges, no SOLVES edges pointing to non-existent problems).

### Phase 2 — The Extraction Layer
Build the requirement extractor.
- Input: raw text.
- Output: structured `Requirements` object.
- Validate by running 20 diverse prompts and manually checking that
  implicit constraints are always captured.

### Phase 3 — The Adversarial Pass
Build the failure mode generator before the design generator.
This is counterintuitive but critical. If you build the designer first, it
will be optimized for "happy path" outputs. Build the adversary first to
establish the standard of rigor the designer must meet.

### Phase 4 — The Design Resolver
Build the design engine that consumes requirements + failure modes and
produces an algorithmic design validated against the Knowledge Base.

### Phase 5 — The Invariant Engine
Build the invariant extractor and the simulation runner.

### Phase 6 — The Output Layer
Build the document renderer and the structured API.

### Phase 7 — The UI
A spatial canvas where the architecture is rendered visually as the
engine reasons. The output must be readable without technical background.

---

## 9. Resolved Decisions & Their Downstream Implications

### Decision 1 — Verification: Formal Model Checking
**Verdict**: We use formal model checking, not probabilistic simulation.

**What this means for the build**:
- Every invariant the engine produces must be expressible in a **formal
  specification language**. The strongest candidate for MVP is **TLA+** (used
  by AWS, Microsoft, and Intel to verify distributed protocols). An alternative
  is **Alloy** (lighter, more accessible).
- The engine's "Invariant Extractor" pass must produce a `.tla` or `.als`
  file alongside the markdown output. This file is the machine-checkable
  proof.
- **Hard implication**: If a design cannot be expressed formally, the engine
  must reject it and redesign. A "good-sounding but unverifiable" design is
  treated as an invalid output.
- **Build requirement**: We need a TLA+ model checker (TLC) or Alloy Analyzer
  embedded as a subprocess in the verification layer. The engine calls it,
  reads the result, and if any invariant is violated during model checking, it
  feeds the violation back into Pass 4 (Design Resolver) for a rewrite.

**Failure edge case specific to formal checking**:
The state space explosion problem. TLA+ model checking can become
computationally intractable if the state space is too large (e.g., modeling
a system with 10 services, each with 5 state values). We must define a
**scope constraint** — the formal model only verifies the core invariants
(safety properties) against a bounded state space, not the entire system.
Liveness properties (e.g., "the system eventually processes every request")
are documented but not formally verified in MVP.

---

### Decision 2 — Specialization: Domain-First Approach
**Verdict**: We specialize first. General-purpose comes after.

**What this means for the build**:
- The Knowledge Base graph is not built generically. It is built specifically
  for the target domain's failure modes and patterns.
- The Adversarial Pass is pre-loaded with domain-specific failure scenarios,
  not generated purely from the prompt. For example, a fintech domain
  pre-loads: "double charge," "stale balance read under concurrency,"
  "payment completed but notification lost."
- **The domain must be chosen before building the Knowledge Base.** The graph
  structure is the same regardless of domain, but the nodes and edges are
  domain-specific.

**Which domain first** — this is the remaining open question. Candidates:
  - **Fintech / Payments**: Highest stakes, richest failure mode library,
    directly validates the tool's core value proposition (no double spend,
    atomic transfers, idempotent retries).
  - **E-commerce**: Slightly lower stakes but broader audience (inventory,
    checkout, flash sales — all of which we have built and understand deeply).
  - **Distributed Ledger / Smart Contracts**: Highest precision requirements,
    smallest initial market, but strongest "proof of correctness" story.

> **Pending Input**: Which domain do we target first?

---

### Decision 3 — Output Format: Markdown
**Verdict**: All output is structured Markdown. No custom DSL for the
human-readable output. The formal model (TLA+/Alloy) is a separate generated
artifact alongside the markdown.

**What this means for the build**:
- The output renderer is simple. No visual canvas engine needed for MVP.
- Markdown is version-controlled via Git. Spec changes are tracked as diffs.
  This is critical for Decision 5 (delta analysis when requirements change).
- **Structure rule**: The markdown must follow a strict, machine-parseable
  heading schema so the document can be programmatically diffed when
  requirements change.

```
# [Spec Title]
## 1. Requirements
### 1.1 Functional
### 1.2 Non-Functional
### 1.3 Implicit Constraints
## 2. Assumptions
## 3. Failure Mode Register
## 4. Domain Decomposition
## 5. Algorithms
## 6. Invariants
## 7. Formal Model
## 8. Implementation Order
## 9. (Optional) Code Scaffold
```

Every section heading is a fixed contract. Tools downstream (diff engine,
formal extractor) rely on these headings being consistent.

---

### Decision 4 — LLM Strategy: Multi-Model Architecture, Single Model MVP
**Verdict**: Design for multi-model. Ship with single model.

**What this means for the build**:
- The reasoning pipeline must be written as a **pluggable agent interface**.
  Each pass (Extraction, Adversarial, Design, Invariant) calls a
  `ReasoningAgent` trait/interface, not a specific LLM directly.
- For MVP, all passes use the same underlying model. The architecture does
  not change — only the routing.
- **Build requirement**: Every agent pass must have a structured input schema
  and a validated output schema. If an agent returns output that doesn't
  conform to the schema, the pass is retried (up to 3 times), then fails
  with an explicit error, not a silent bad output.
- When we move to multi-model, we route by pass type:
  - **Extraction**: A fast, instruction-following model (low cost).
  - **Adversarial**: A model known for creative, lateral reasoning.
  - **Design**: A model with deep technical training.
  - **Formal Extraction**: A model fine-tuned or prompted specifically on
    TLA+/Alloy syntax.

---

### Decision 5 — Human-in-the-Loop: Question-Gated Intervention
**Verdict**: Human intervention only happens at the clarification gate.
If no questions are needed, the tool runs end-to-end and delivers the spec.

**What this means for the build**:
- The Extraction Pass (Pass 1) must include a **Completeness Checker**.
  After extracting requirements, the checker evaluates whether any
  non-functional requirements, scale targets, or consistency requirements
  are ambiguous or missing.
- If the Completeness Checker finds gaps, it generates a **Clarification
  List** (minimum questions, not exhaustive) and pauses.
- If no gaps are found, the pipeline continues without interruption.
- **The Clarification List must be prioritized.** The tool must not dump 15
  questions on the user. It asks only the questions where the answer will
  materially change the design. Questions where the tool can make a reasonable
  default assumption are not asked — the assumption is documented instead.
- **Async model**: The user answers questions asynchronously. The spec is
  not partially generated during this wait. Generation starts fresh once
  answers are received. This prevents the tool from producing a spec based
  on assumptions it later has to retract.

**Example of what NOT to ask**:
> "Do you want logging?" — The tool always includes observability. Not asked.

**Example of what MUST be asked**:
> "Your prompt implies real-time consistency, but you also mentioned global
> distribution. These conflict at the CAP boundary. Do you prioritize
> Consistency (risk: regional outages during partition) or Availability
> (risk: stale reads during partition)?"

---

## 10. Next Step

The five foundational decisions are locked. The one remaining open question
is **domain selection** (Decision 2).

Once the domain is chosen, the next document to produce is:

**`KNOWLEDGE_BASE.md`** — The Engineering Primitives Graph for the chosen
domain. This is the ground truth the reasoning engine validates against.
It must be completed before any code for the platform is written, because
the knowledge base IS the engine's intelligence. Without it, the passes
are reasoning in a vacuum.

