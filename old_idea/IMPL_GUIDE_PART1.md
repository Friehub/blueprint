# Engineering Blueprinter — Implementation Guide
## Part 1: Project Setup, Tech Stack, Build Order

> Written for a code-generation model. Pre-digests all design decisions.
> Read all 5 parts before generating any file.

---

## What This System Does

5-pass reasoning pipeline: plain-English prompt → formally verified engineering spec.
NOT a code generator. Generates the specification that code must satisfy.

```
Prompt → Pass1(Extract) → Gate → Pass2(Decompose) → Pass3(Adversarial)
       → Pass4(Design) → Pass5(TLA+ Verify) → Output Assembly
```

Target runtime (no clarification): < 5 minutes.

---

## Tech Stack (Fixed)

| Layer | Choice | Reason |
|-------|--------|--------|
| Runtime | Node.js 20+ TypeScript | LLM SDK support |
| Framework | Fastify | Schema validation built-in |
| Schema Validation | Zod | All pass I/O validated at runtime |
| Database | PostgreSQL 16 + pg | JSONB outputs, transactions |
| LLM Client | Vercel AI SDK (ai package) | Provider-agnostic |
| TLA+ Runner | child_process.spawn (TLC) | TLC on host, not Docker |
| IDs | ulid package | Time-sortable spec IDs |

---

## Repository Structure

```
src/
├── index.ts                   -- Fastify bootstrap, health check only
├── config.ts                  -- Zod env schema, exit if invalid
├── db.ts                      -- pg Pool singleton, no queries here
├── errors.ts                  -- Domain error classes
├── knowledge/
│   ├── loader.ts              -- Parses KNOWLEDGE_BASE.md into graph at startup
│   ├── graph.ts               -- KnowledgeGraph class with query methods
│   └── types.ts               -- KnowledgeNode, KnowledgeEdge interfaces
├── pipeline/
│   ├── orchestrator.ts        -- Runs passes in order, handles retries
│   ├── clarification-gate.ts  -- Pause/resume/timeout logic
│   ├── schemas.ts             -- Zod schemas for ALL pass inputs/outputs
│   ├── pass1-extraction.ts
│   ├── pass2-decomposition.ts
│   ├── pass3-adversarial.ts
│   ├── pass4-design.ts
│   ├── pass5-verification.ts
│   ├── tla-generator.ts       -- Generates .tla/.cfg files, NO LLM
│   ├── tlc-runner.ts          -- Spawns TLC subprocess, parses stdout
│   └── output-assembler.ts    -- Deterministic markdown render, NO LLM
├── api/
│   ├── routes.ts
│   ├── spec-controller.ts
│   ├── sse.ts                 -- SSE event emitter
│   └── middleware.ts          -- Auth token validation
├── storage/
│   ├── spec-runs.ts
│   ├── pass-outputs.ts
│   ├── clarifications.ts
│   ├── formal-models.ts
│   └── rendered-specs.ts
└── scaffold/
    ├── generator.ts           -- Dispatches to language generators
    ├── rust-axum.ts
    ├── typescript-node.ts
    └── solidity.ts
```

---

## Build Order (Each Step Depends on Previous)

1. **config.ts + db.ts** — Zod env validation, pg Pool. Exit if missing vars.
2. **Database migration** — Create tables in order (STORAGE.md SQL).
3. **knowledge/** — Parse KNOWLEDGE_BASE.md into in-memory graph at startup.
   Unit test: no circular REQUIRES edges, all SOLVES targets exist as nodes.
4. **pipeline/schemas.ts** — All 10 Zod schemas (5 inputs + 5 outputs). No other deps.
5. **pass1-extraction.ts** — Uses PROMPTS.md Pass 1 prompt verbatim. Retry 3x.
6. **pass3-adversarial.ts** — Build adversary BEFORE designer (establishes rigor bar).
7. **pass2-decomposition.ts + pass4-design.ts** — Build together, tightly coupled.
   Pass 4 validates every pattern against KnowledgeGraph.
8. **tla-generator.ts + tlc-runner.ts** — Template generator (no LLM) + TLC spawn.
   Run all model groups in parallel via Promise.all.
9. **pass5-verification.ts** — Wires LLM → generator → TLC. Max 3 feedback loops.
10. **output-assembler.ts** — Pure string template render. Zero LLM calls.
11. **storage/** — 5 modules. Completion invariant: status=completed only after rendered_specs row exists.
12. **api/** — POST /specs, GET /specs/:id/stream (SSE), POST clarifications, GET result.
13. **scaffold/** — Final. Stubs only. Every function has structured TODO citing spec.

---

## Cross-Cutting Rules (Enforced Everywhere)

1. No floating promises. No empty catch blocks.
2. Every LLM call validates output schema. Retry 3x with error context appended.
3. Pipeline never silently recovers — every degraded state surfaced to user.
4. No LLM in output-assembler.ts. Deterministic template only.
5. TLC has no wall-clock timeout. Bounds in .cfg ensure termination.
6. KnowledgeGraph loaded once at startup, shared by all requests.
7. All credentials from loadConfig(), never hardcoded.
