# Engineering Blueprinter -- Implementation Guide
## Part 5: Orchestrator, Storage, API, SSE, and Scaffold Rules

---

## pipeline/orchestrator.ts

```typescript
import { KnowledgeGraph } from "../knowledge/graph";
import { runPass1 } from "./pass1-extraction";
import { evaluateGate, pauseForClarification } from "./clarification-gate";
import { runPass2, CircularDependencyError } from "./pass2-decomposition";
import { runPass3 } from "./pass3-adversarial";
import { runPass4 } from "./pass4-design";
import { runPass5 } from "./pass5-verification";
import { assembleSpec } from "./output-assembler";
import { SseEmitter } from "../api/sse";
import * as storage from "../storage";

export interface RunOptions {
  specRunId: string;
  prompt: string;
  userContext?: string;
  knowledgeGraph: KnowledgeGraph;
  emitter: SseEmitter;
}

/**
 * Main pipeline execution. Runs all passes in order.
 * Each pass emits SSE events for real-time progress.
 * Violation feedback loop: Pass5 → Pass4 max 3 times.
 */
export async function runPipeline(opts: RunOptions): Promise<void> {
  const { specRunId, prompt, userContext, knowledgeGraph, emitter } = opts;
  const MAX_REDESIGN_ITERATIONS = 3;

  try {
    // Pass 1
    emitter.emit(specRunId, "pass_started", { pass: 1, name: "Extraction" });
    const pass1Start = Date.now();
    const extraction = await runPass1(prompt, knowledgeGraph, userContext);
    await storage.passOutputs.save(specRunId, 1, extraction);
    emitter.emit(specRunId, "pass_completed", {
      pass: 1, name: "Extraction",
      duration_ms: Date.now() - pass1Start,
      summary: `Extracted ${extraction.functional_requirements.length} requirements, ${extraction.assumptions.length} assumptions.`,
    });

    // Clarification Gate
    const gateStatus = evaluateGate(extraction);
    if (gateStatus === "blocking") {
      emitter.emit(specRunId, "clarification_required", {
        spec_id: specRunId,
        questions: extraction.clarification_questions.filter((q) => q.blocking),
        answer_url: `POST /specs/${specRunId}/clarifications`,
        timeout_seconds: 300,
      });
      await pauseForClarification(specRunId, extraction.clarification_questions);
      return; // Pipeline will be resumed by POST /clarifications
    }

    // Pass 2
    emitter.emit(specRunId, "pass_started", { pass: 2, name: "Decomposition" });
    const pass2Start = Date.now();
    const decomposition = await runPass2(extraction);
    await storage.passOutputs.save(specRunId, 2, decomposition);
    emitter.emit(specRunId, "pass_completed", { pass: 2, duration_ms: Date.now() - pass2Start });

    // Pass 3
    emitter.emit(specRunId, "pass_started", { pass: 3, name: "Adversarial" });
    const pass3Start = Date.now();
    const adversarial = await runPass3(decomposition, knowledgeGraph);
    await storage.passOutputs.save(specRunId, 3, adversarial);
    emitter.emit(specRunId, "pass_completed", { pass: 3, duration_ms: Date.now() - pass3Start });

    // Pass 4 + Pass 5 feedback loop
    let design = await runPass4(extraction, decomposition, adversarial, knowledgeGraph);
    await storage.passOutputs.save(specRunId, 4, design);

    let verification = await runPass5(design, knowledgeGraph);

    for (const result of verification) {
      emitter.emit(specRunId, "verification_result", {
        model_id: result.modelId,
        status: result.status,
        duration_ms: result.durationMs,
        bounds: result.verificationBounds,
        ...(result.status === "VIOLATED" ? { redesigning: true } : {}),
      });
    }

    // Feedback loop: violated models trigger Pass 4 redesign
    let iteration = 0;
    while (
      iteration < MAX_REDESIGN_ITERATIONS &&
      verification.some((v) => v.status === "VIOLATED")
    ) {
      iteration++;
      const violated = verification.find((v) => v.status === "VIOLATED" && v.translatedTrace);
      if (!violated) break;

      design = await runPass4(extraction, decomposition, adversarial, knowledgeGraph, {
        invariant: violated.counterexampleTrace ?? "",
        trace: violated.translatedTrace ?? "",
      });
      await storage.passOutputs.save(specRunId, 4, design);

      verification = await runPass5(design, knowledgeGraph);
      for (const result of verification) {
        emitter.emit(specRunId, "verification_result", {
          model_id: result.modelId, status: result.status,
          duration_ms: result.durationMs, bounds: result.verificationBounds,
        });
      }
    }

    // Surface unresolvable conflicts
    const stillViolated = verification.filter((v) => v.status === "VIOLATED");
    if (stillViolated.length > 0) {
      await storage.specRuns.setFailed(specRunId, "UNRESOLVABLE_DESIGN_CONFLICT");
      emitter.emit(specRunId, "failed", {
        spec_id: specRunId, status: "failed",
        error: "UNRESOLVABLE_DESIGN_CONFLICT",
        message: `Invariant violation unresolved after ${MAX_REDESIGN_ITERATIONS} redesigns.`,
      });
      return;
    }

    // Output Assembly (no LLM)
    const markdown = assembleSpec(prompt, extraction, decomposition, adversarial, design, verification);
    await storage.renderedSpecs.save(specRunId, markdown);
    await storage.specRuns.setCompleted(specRunId); // Atomic with rendered_specs

    emitter.emit(specRunId, "completed", {
      spec_id: specRunId, status: "completed",
      overall_verification: "VERIFIED",
      spec_url: `GET /specs/${specRunId}/result`,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await storage.specRuns.setFailed(specRunId, message);
    emitter.emit(specRunId, "failed", { spec_id: specRunId, status: "failed", error: message });
  }
}
```

---

## api/sse.ts

```typescript
import { FastifyReply } from "fastify";

type SseEvent = Record<string, unknown>;

export class SseEmitter {
  private connections: Map<string, FastifyReply[]> = new Map();

  register(specId: string, reply: FastifyReply): void {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });
    const existing = this.connections.get(specId) ?? [];
    this.connections.set(specId, [...existing, reply]);

    reply.raw.on("close", () => {
      const current = this.connections.get(specId) ?? [];
      this.connections.set(specId, current.filter((r) => r !== reply));
    });
  }

  emit(specId: string, eventType: string, data: SseEvent): void {
    const connections = this.connections.get(specId) ?? [];
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const conn of connections) {
      conn.raw.write(payload);
      if (eventType === "completed" || eventType === "failed") {
        conn.raw.end();
      }
    }
  }
}

export const sseEmitter = new SseEmitter();
```

---

## storage/spec-runs.ts (representative -- same pattern for other tables)

```typescript
import { db } from "../db";
import { ulid } from "ulid";

export async function create(
  userId: string,
  prompt: string,
  options: Record<string, unknown>,
): Promise<string> {
  const id = `spec_${ulid()}`;
  await db.query(
    `INSERT INTO spec_runs (id, user_id, prompt, status, options)
     VALUES ($1, $2, $3, 'running', $4)`,
    [id, userId, prompt, JSON.stringify(options)],
  );
  return id;
}

export async function setCompleted(specRunId: string): Promise<void> {
  // This MUST be called in the same transaction as rendered_specs INSERT
  // to enforce the completion invariant. In practice, call from a single tx helper.
  await db.query(
    `UPDATE spec_runs SET status = 'completed', completed_at = now()
     WHERE id = $1`,
    [specRunId],
  );
}

export async function setFailed(specRunId: string, reason: string): Promise<void> {
  await db.query(
    `UPDATE spec_runs SET status = 'failed', completed_at = now()
     WHERE id = $1`,
    [specRunId],
  );
}
```

---

## api/routes.ts (route registrations)

```typescript
import { FastifyInstance } from "fastify";
import { sseEmitter } from "./sse";
import * as specController from "./spec-controller";

export async function registerRoutes(app: FastifyInstance): Promise<void> {

  // POST /specs -- create and start pipeline
  app.post("/v1/specs", {
    schema: {
      body: {
        type: "object",
        required: ["prompt", "domain"],
        properties: {
          prompt: { type: "string", minLength: 1, maxLength: 4000 },
          domain: { type: "string", enum: ["fintech"] },
          options: { type: "object" },
        },
      },
    },
  }, specController.createSpec);

  // GET /specs/:id/stream -- SSE stream
  app.get("/v1/specs/:spec_id/stream", specController.streamSpec);

  // POST /specs/:id/clarifications -- resume paused pipeline
  app.post("/v1/specs/:spec_id/clarifications", specController.submitClarifications);

  // GET /specs/:id/result -- get final markdown or JSON
  app.get("/v1/specs/:spec_id/result", specController.getResult);

  // GET /specs/:id/formal-models -- download TLA+ files as ZIP
  app.get("/v1/specs/:spec_id/formal-models", specController.getFormalModels);

  // GET /specs/:id -- get spec metadata
  app.get("/v1/specs/:spec_id", specController.getSpec);

  // GET /specs -- list user's specs with filtering
  app.get("/v1/specs", specController.listSpecs);
}
```

---

## api/middleware.ts (auth token validation)

```typescript
import { FastifyRequest, FastifyReply } from "fastify";

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const auth = request.headers["authorization"];
  if (!auth?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "UNAUTHORIZED", message: "Bearer token required" });
    return;
  }
  const token = auth.slice(7);
  // Token format: ebp_live_sk_ or ebp_test_sk_
  if (!token.startsWith("ebp_")) {
    reply.code(401).send({ error: "INVALID_TOKEN", message: "Token must start with ebp_" });
    return;
  }
  // Attach environment to request
  (request as any).isTestEnv = token.startsWith("ebp_test_");
}
```

---

## Scaffold Anti-Patterns -- What to NEVER Generate

The scaffold generator must detect and refuse these patterns:

| Forbidden | Replacement |
|-----------|-------------|
| `amount: number` or `amount: f64` | `amount: Money` class / `Amount` newtype |
| `status: string` | Discriminated union or enum |
| Idempotency key as optional param | Required parameter, no default |
| `catch (e) {}` empty catch | Typed error handling with named variants |
| `any` type annotation | Named interface or `unknown` with guard |
| `console.log` for errors | Structured logger with transaction_id |
| Hardcoded secret string | `loadConfig()` env var pattern |
| `// TODO: handle errors` comment | Typed `Result` or error enum |
| Direct DB query in service class | Call to repository interface method |
| `asyncFn()` without `await` | Always `await asyncFn()` |

---

## Scaffold Completeness Invariant (Check After Generation)

Before declaring the scaffold complete, verify:

1. Every FR-xxx maps to at least one function signature.
2. Every MUST_RESOLVE failure mode maps to at least one type constraint.
3. Every algorithm step requiring a specific pattern has a `// SPEC[...]` comment.
4. No function body contains actual business logic -- only `todo!()` / `throw` / `revert()`.
5. All modules compile clean: `tsc --noEmit` / `cargo check` / `forge build`.

---

## Database Migration SQL (Run in Order)

```sql
-- 1. spec_runs
CREATE TABLE spec_runs (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  prompt          TEXT NOT NULL,
  domain          TEXT NOT NULL DEFAULT 'fintech',
  status          TEXT NOT NULL CHECK (status IN (
    'running','awaiting_clarification','completed','failed'
  )),
  options         JSONB NOT NULL DEFAULT '{}',
  parent_spec_id  TEXT REFERENCES spec_runs(id),
  change_summary  TEXT,
  reused_passes   INTEGER[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  total_ms        INTEGER
);
CREATE INDEX ON spec_runs (user_id, created_at DESC);
CREATE INDEX ON spec_runs (status) WHERE status IN ('running','awaiting_clarification');

-- 2. pass_outputs
CREATE TABLE pass_outputs (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  spec_run_id     TEXT NOT NULL REFERENCES spec_runs(id),
  pass_number     INTEGER NOT NULL CHECK (pass_number BETWEEN 1 AND 5),
  status          TEXT NOT NULL CHECK (status IN ('completed','failed','retried')),
  output          JSONB NOT NULL,
  attempt_number  INTEGER NOT NULL DEFAULT 1,
  duration_ms     INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (spec_run_id, pass_number, attempt_number)
);

-- 3. clarification_events
CREATE TABLE clarification_events (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  spec_run_id     TEXT NOT NULL REFERENCES spec_runs(id),
  questions       JSONB NOT NULL,
  answers         JSONB,
  status          TEXT NOT NULL CHECK (status IN ('pending','answered','timed_out')),
  asked_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  answered_at     TIMESTAMPTZ,
  timeout_at      TIMESTAMPTZ NOT NULL
);
CREATE INDEX ON clarification_events (status, timeout_at) WHERE status = 'pending';

-- 4. formal_models
CREATE TABLE formal_models (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  spec_run_id     TEXT NOT NULL REFERENCES spec_runs(id),
  model_id        TEXT NOT NULL,
  tla_source      TEXT NOT NULL,
  cfg_source      TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('verified','violated','error')),
  verification_bounds JSONB NOT NULL,
  counterexample  TEXT,
  duration_ms     INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. rendered_specs (completion invariant: exists IFF spec_runs.status = 'completed')
CREATE TABLE rendered_specs (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  spec_run_id     TEXT NOT NULL REFERENCES spec_runs(id) UNIQUE,
  markdown        TEXT NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. spec_artifacts (object storage references)
CREATE TABLE spec_artifacts (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  spec_run_id     TEXT NOT NULL REFERENCES spec_runs(id),
  artifact_type   TEXT NOT NULL CHECK (artifact_type IN ('tla_bundle','scaffold')),
  storage_key     TEXT NOT NULL,
  size_bytes      BIGINT NOT NULL,
  content_type    TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Final Checklist Before Shipping

- [ ] `knowledge/loader.ts` parses all 10 failure modes and 13 nodes from KNOWLEDGE_BASE.md
- [ ] `graph.validate()` returns empty array at startup
- [ ] All 10 Zod schemas in `schemas.ts` match PIPELINE.md contracts
- [ ] Pass 1 prompt is copied verbatim from PROMPTS.md
- [ ] Pass 3 built and tested before Pass 4
- [ ] TLC binary path is configurable via env var
- [ ] TLA+ model generation produces syntactically valid TLA+ (test against TLC directly)
- [ ] No wall-clock timeout on TLC -- only `.cfg` bounds control termination
- [ ] `output-assembler.ts` has zero LLM calls
- [ ] `status = completed` only set inside same DB transaction as `rendered_specs` INSERT
- [ ] All API endpoints require `Authorization: Bearer ebp_*` header
- [ ] Test tokens (`ebp_test_sk_*`) use fixture responses, not real LLM
- [ ] Scaffold compiles clean for all 3 target languages
