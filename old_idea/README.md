# Engineering Blueprinter
## A Prompt-to-Specification Platform for Financial Systems

---

## What This Is

Engineering Blueprinter transforms a feature description into a
**formally verified engineering specification** before any code is written.

It does not generate code. It generates the engineering truth that code
must implement: the requirements, the algorithms, the failure modes, the
invariants, and the proof that the design is correct.

**Input**: "Build a multi-currency wallet where users can swap between USD and EUR instantly and never spend money they don't have."

**Output**: A complete specification covering:
- All functional and non-functional requirements (with defaults documented)
- A domain-decomposed service map with data ownership boundaries
- A Failure Mode Register: 10 pre-loaded fintech failure scenarios checked against your design
- Step-by-step algorithmic designs for every core operation
- Safety invariants formally verified using TLA+ model checking
- An implementation order derived from the dependency graph
- (Optional) Language-specific code scaffolds that enforce the design at the type level

---

## Why It Exists

AI coding tools convert a prompt to code. This is fast but dangerous for
systems where correctness matters: payments, financial state, anything
that touches money or permanent records.

The failure modes that destroy financial systems -- double charges, partial
commits, stale balance reads, silent authorization expiry -- are not bugs
in the code. They are bugs in the design. They appear in code review as
"this looks right" and in production as "our books don't balance."

This platform forces the design to exist and to be verified before
implementation begins.

---

## Documentation Index

| Document | What It Covers |
|----------|---------------|
| [BLUEPRINT.md](./BLUEPRINT.md) | Why we built it this way: foundational decisions, architecture choices, and their downstream implications. |
| [KNOWLEDGE_BASE.md](./KNOWLEDGE_BASE.md) | The ground truth: 10 fintech failure modes with formal invariants, 13 engineering primitive nodes with trade-off relationships. |
| [PIPELINE.md](./PIPELINE.md) | Execution logic: 5 reasoning passes, their input/output schemas, validation rules, and the decomposed formal verification model. |
| [SCAFFOLD.md](./SCAFFOLD.md) | Code generation rules: what is generated, what is never generated, and how invariants are enforced at the type level per language. |
| [PROMPTS.md](./PROMPTS.md) | Exact LLM prompt templates for each pass with system roles, output schemas, and retry addendums. |
| [API.md](./API.md) | REST API specification: endpoints, request/response contracts, SSE event types, and rate limits. |
| [STORAGE.md](./STORAGE.md) | Persistence: data model, versioning strategy, delta analysis for requirement changes, retention, and consistency requirements. |

---

## How the Pipeline Works (Summary)

```
User Prompt
    ↓
Pass 1: Extract requirements, constraints, and assumptions.
    ↓
Clarification Gate: Ask only blocking questions. Skip if none.
    ↓
Pass 2: Decompose into bounded contexts. Detect circular dependencies.
    ↓
Pass 3: Adversarial stress test. Match against Failure Mode Register.
    ↓
Pass 4: Design algorithms that survive the adversary.
        Selected patterns validated against Knowledge Base graph.
    ↓
Pass 5: Extract safety invariants. Generate one TLA+ model per invariant
        group. Run TLC in parallel with symmetry reduction and explicit
        bounds. No timeout fallback -- bounds ensure termination.
        If violated: full counterexample trace fed back to Pass 4.
    ↓
Output Assembly: Deterministic markdown render. No LLM in this step.
    ↓
Verified .spec.md + .tla formal models
```

**Total runtime (no clarification required)**: < 5 minutes.

---

## Key Design Decisions (Summary)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Verification | Formal model checking (TLA+/TLC) | Proof of correctness, not probabilistic sampling |
| Domain | Fintech/Payments first | Richest failure mode library, strongest value proposition |
| Output format | Structured Markdown | Version-controllable via Git, machine-parseable headings |
| LLM strategy | Multi-model architecture, single model MVP | Design for extensibility, ship with simplicity |
| Human intervention | Question-gated only | Run end-to-end unless the design is ambiguous |
| State space management | Decomposed models + symmetry reduction | Eliminates explosion without timeout hacks |

Full rationale for each decision is in [BLUEPRINT.md](./BLUEPRINT.md) §9.

---

## What Is Not Implemented in MVP

| Feature | Status | Notes |
|---------|--------|-------|
| Multi-model routing per pass | Planned | Currently all passes use one model |
| Liveness property verification | Documented, not verified | State space constraints |
| Spec semantic search | Planned | Requires vector embeddings |
| E-commerce domain | Next domain | After fintech is stable |
| Smart contracts domain | Planned | Third domain |
| Visual canvas output | Planned | Post-MVP |
| TLAPS proof system | Future | Mathematical proof vs. bounded model checking |

---

## Build Order

When implementation begins, follow this order. Each phase depends on the
previous being complete and tested.

1. **Knowledge Base loader** -- Parse `KNOWLEDGE_BASE.md` into an in-memory
   graph. Write unit tests verifying graph consistency (no circular REQUIRES
   edges, all SOLVES targets exist as nodes).

2. **Pass output schemas** -- Implement the TypeScript interfaces from
   `PIPELINE.md` as validated Zod schemas. The pipeline's correctness
   depends on these being exact.

3. **Pass 1 (Extraction)** -- Implement with prompt from `PROMPTS.md`.
   Validate against 20 diverse fintech prompts manually before proceeding.

4. **Pass 3 (Adversarial)** -- Implement before Pass 4. Build the adversary
   before the designer. If you build the designer first, it optimizes for
   happy-path outputs.

5. **Pass 2 (Decomposition)** and **Pass 4 (Design)** -- Implement together.
   They are closely coupled: decomposition is Pass 4's structural input.

6. **TLA+ model generator** -- The most technically demanding component.
   Implement the per-model decomposition logic, symmetry declarations, and
   `.cfg` generation. Test against the 4 standard fintech model groups in
   `PIPELINE.md` §Pass 5.

7. **Pass 5 (Verification)** -- Wire the TLA+ generator to TLC subprocess
   execution. Implement parallel model execution and violation feedback loop.

8. **Output Assembly** -- Template rendering. Deterministic. No LLM.

9. **Storage layer** -- Implement the schema from `STORAGE.md`. Ensure
   atomic completion invariant: `completed` status only set when
   `rendered_specs` row exists.

10. **API layer** -- Implement endpoints from `API.md`. SSE stream for
    progress events. Test with `test_` environment tokens.

11. **Scaffold generator** -- Final component. Follows rules from
    `SCAFFOLD.md`. Must compile clean (`cargo check` / `tsc --noEmit`).
