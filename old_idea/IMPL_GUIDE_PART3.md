# Engineering Blueprinter -- Implementation Guide
## Part 3: Pipeline Passes 1–3 and the Clarification Gate

---

## The LLM Agent Helper (shared by all passes)

All passes use this pattern. Create `pipeline/agent.ts`:

```typescript
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z, ZodSchema } from "zod";
import { loadConfig } from "../config";

const config = loadConfig();

export async function runAgentPass<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: ZodSchema<T>,
  passName: string,
  maxRetries = 3,
): Promise<T> {
  let lastError: string = "";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const userMessage = attempt === 1
      ? userPrompt
      : `${userPrompt}\n\nPREVIOUS ATTEMPT FAILED SCHEMA VALIDATION:\n${lastError}\nCorrect and return only valid JSON.`;

    try {
      const result = await generateObject({
        model: openai("gpt-4o"),
        system: systemPrompt,
        prompt: userMessage,
        schema,                  // Vercel AI SDK uses Zod schema for structured output
      });
      return result.object;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt === maxRetries) {
        throw new PipelinePassError(passName, attempt, lastError);
      }
    }
  }
  throw new PipelinePassError(passName, maxRetries, lastError);
}

export class PipelinePassError extends Error {
  constructor(
    public readonly pass: string,
    public readonly attempts: number,
    public readonly lastError: string,
  ) {
    super(`Pass ${pass} failed after ${attempts} attempts: ${lastError}`);
  }
}
```

---

## pass1-extraction.ts

```typescript
import { ExtractionOutput, ExtractionOutputSchema } from "./schemas";
import { KnowledgeGraph } from "../knowledge/graph";
import { runAgentPass } from "./agent";

const SYSTEM_PROMPT = `You are a Principal Engineer specializing in distributed systems and
financial technology. Your role in this pipeline is EXTRACTION ONLY.

You read a feature description and extract a precise, structured set of requirements.
You do not design anything. You do not suggest implementations.
You only extract and classify what the user is asking for.

Domain context: Fintech / Payment Systems.

Hard constraints:
- Every functional requirement must use MUST, SHOULD, or MAY.
  No vague language -- expand "handle" or "support" into explicit verifiable statements.
- Implicit fintech constraints are always applied:
  observability, immutable audit trail, secrets in env vars,
  amounts in minor units, idempotency on all mutations, health checks.
- If a requirement is ambiguous in a way that would materially change
  the design, generate a clarification question with blocking=true.
  If a safe default exists, apply it and document it as an assumption instead.
- Output ONLY valid JSON matching the schema. No markdown fences.`;

export async function runPass1(
  rawPrompt: string,
  knowledgeGraph: KnowledgeGraph,
  userContext?: string,
): Promise<ExtractionOutput> {
  const implicitConstraints = knowledgeGraph.getImplicitConstraints()
    .map((c) => c.statement)
    .join("\n- ");

  const userPrompt = `FEATURE DESCRIPTION:
${rawPrompt}

ADDITIONAL CONTEXT:
${userContext ?? "None provided"}

FINTECH IMPLICIT CONSTRAINTS (always apply these -- do not ask about them):
- ${implicitConstraints}

DEFAULT NON-FUNCTIONAL REQUIREMENTS (apply if not specified in prompt):
- Throughput: 100 transactions/second
- p99 latency (payment auth): < 3 seconds
- Availability: 99.9%
- Data durability: 99.999999%
- Consistency: Strong (not configurable for payment balances)

Extract requirements and produce JSON matching the ExtractionOutput schema.`;

  return runAgentPass(
    SYSTEM_PROMPT,
    userPrompt,
    ExtractionOutputSchema,
    "Pass1-Extraction",
  );
}
```

---

## clarification-gate.ts

```typescript
import { ClarificationQuestion, ExtractionOutput } from "./schemas";
import { db } from "../db";

export type GateStatus = "no_questions" | "non_blocking" | "blocking";

export function evaluateGate(output: ExtractionOutput): GateStatus {
  const questions = output.clarification_questions;
  if (questions.length === 0) return "no_questions";
  if (questions.some((q) => q.blocking)) return "blocking";
  return "non_blocking";
}

/**
 * Pauses the pipeline and stores clarification state.
 * Returns the questions to surface to the user.
 * The pipeline resumes only after POST /specs/:id/clarifications.
 */
export async function pauseForClarification(
  specRunId: string,
  questions: ClarificationQuestion[],
): Promise<void> {
  const timeoutAt = new Date(Date.now() + 300_000); // 300 seconds
  await db.query(
    `INSERT INTO clarification_events
       (id, spec_run_id, questions, status, timeout_at)
     VALUES ($1, $2, $3, 'pending', $4)`,
    [
      generateId(),
      specRunId,
      JSON.stringify(questions),
      timeoutAt.toISOString(),
    ],
  );
  await db.query(
    `UPDATE spec_runs SET status = 'awaiting_clarification' WHERE id = $1`,
    [specRunId],
  );
}

/**
 * Called when the user submits answers via POST /specs/:id/clarifications.
 * Updates the extraction output with the new information and resumes.
 */
export async function recordAnswers(
  specRunId: string,
  answers: Array<{ question_id: string; answer: string }>,
): Promise<void> {
  const answeredAt = new Date().toISOString();
  await db.query(
    `UPDATE clarification_events
     SET answers = $1, status = 'answered', answered_at = $2
     WHERE spec_run_id = $3 AND status = 'pending'`,
    [JSON.stringify(answers), answeredAt, specRunId],
  );
  await db.query(
    `UPDATE spec_runs SET status = 'running' WHERE id = $1`,
    [specRunId],
  );
}

/**
 * Non-blocking questions: auto-apply defaults after 60 seconds.
 * Called by a background job that scans for timed-out non-blocking gates.
 */
export async function applyDefaultsAndResume(specRunId: string): Promise<void> {
  await db.query(
    `UPDATE clarification_events
     SET status = 'timed_out'
     WHERE spec_run_id = $1 AND status = 'pending' AND timeout_at < now()`,
    [specRunId],
  );
  await db.query(
    `UPDATE spec_runs SET status = 'running' WHERE id = $1`,
    [specRunId],
  );
}
```

---

## pass2-decomposition.ts

```typescript
import { ExtractionOutput, DecompositionOutput, DecompositionOutputSchema } from "./schemas";
import { runAgentPass } from "./agent";

const SYSTEM_PROMPT = `You are a Principal Engineer specializing in domain-driven design
for financial systems. Your role is DECOMPOSITION ONLY.

You receive structured requirements and produce a bounded context map.

Hard constraints:
- One service owns one concept. No shared table ownership.
- Services communicate only through defined interfaces, never direct DB access.
- Every functional requirement must be traceable to exactly one service.
- Detect and explicitly list circular dependencies in circular_dependencies[].
  Do NOT resolve them -- mark them. The pipeline will surface them.
- Output ONLY valid JSON matching the schema.`;

export async function runPass2(
  extractionOutput: ExtractionOutput,
): Promise<DecompositionOutput> {
  const userPrompt = `REQUIREMENTS:
${JSON.stringify(extractionOutput, null, 2)}

STANDARD FINTECH BOUNDED CONTEXTS (use as starting point, adapt to requirements):
Identity (users, auth, sessions), Wallet (balances, ledger), Payment (intents, authorization),
Compliance (rules, velocity checks), Notification (alerts, receipts), Settlement (batch, payout).

Rules:
- Add, remove, or rename contexts based on actual requirements above.
- Map every FR-xxx to exactly one service.
- Classify every inter-service call as sync (caller needs result) or async (caller does not).
- circular_dependencies MUST be empty to proceed. If any exist, list them -- pipeline will stop.

Produce JSON matching the DecompositionOutput schema.`;

  const result = await runAgentPass(
    SYSTEM_PROMPT,
    userPrompt,
    DecompositionOutputSchema,
    "Pass2-Decomposition",
  );

  // Validation: circular_dependencies must be empty
  if (result.circular_dependencies.length > 0) {
    throw new CircularDependencyError(result.circular_dependencies);
  }

  return result;
}

export class CircularDependencyError extends Error {
  constructor(public readonly cycles: string[]) {
    super(
      `Circular dependencies detected. Resolve before proceeding: ${cycles.join(", ")}`,
    );
  }
}
```

---

## pass3-adversarial.ts

```typescript
import { DecompositionOutput, AdversarialOutput, AdversarialOutputSchema } from "./schemas";
import { KnowledgeGraph } from "../knowledge/graph";
import { runAgentPass } from "./agent";

const SYSTEM_PROMPT = `You are a Senior Reliability Engineer and security adversary.
Your role is to find every possible way the proposed system design can fail in production.
You do NOT design solutions. You ONLY find failure modes.

Think like a chaos engineer: networks are unreliable, clocks drift, disks fail mid-write,
users send duplicate requests. Produce an exhaustive failure mode report.

For each failure mode:
1. Identify the specific service and operation that is vulnerable.
2. Describe the exact sequence of events that causes the failure.
3. State the observable consequence (data loss, incorrect balance, downtime).
4. Reference the matching failure mode from the Knowledge Base if applicable.
5. Score likelihood (HIGH/MEDIUM/LOW) and severity (CRITICAL/HIGH/MEDIUM/LOW).
6. Set risk_score = likelihood_weight * severity_weight (1=LOW, 2=MEDIUM, 3=HIGH/CRITICAL).

Hard constraints:
- Do NOT suggest fixes. ONLY describe failures.
- Every sync interaction generates at least 3 failure scenarios.
- Every async interaction generates at least 3 failure scenarios.
- Output ONLY valid JSON matching the schema.`;

// Applicability rules -- used to pre-filter relevant failure modes before LLM call
const FM_APPLICABILITY: Record<string, (d: DecompositionOutput) => boolean> = {
  "FM-001": (d) => d.services.some((s) => s.publishes.length > 0), // Any state change
  "FM-002": (d) => d.services.some((s) => s.owns.some((t) => t.toLowerCase().includes("balance") || t.toLowerCase().includes("account"))),
  "FM-003": (d) => d.sync_interactions.length > 0,
  "FM-004": (d) => d.services.some((s) => s.reads_from.some((r) => r.includes("EXTERNAL"))),
  "FM-005": (d) => d.sync_interactions.length > 0,
  "FM-006": (d) => true, // Always applicable in fintech
  "FM-007": (d) => d.services.some((s) => s.name.toLowerCase().includes("settlement")),
  "FM-008": (d) => d.services.some((s) => s.name.toLowerCase().includes("payment")),
  "FM-009": (d) => d.services.some((s) => s.consumes.some((e) => e.toLowerCase().includes("webhook"))),
  "FM-010": (d) => d.services.some((s) => s.name.toLowerCase().includes("compliance")),
};

export async function runPass3(
  decompositionOutput: DecompositionOutput,
  knowledgeGraph: KnowledgeGraph,
): Promise<AdversarialOutput> {
  const applicableFMs = knowledgeGraph.getAllFailureModes().filter((fm) => {
    const rule = FM_APPLICABILITY[fm.id];
    return rule ? rule(decompositionOutput) : true;
  });

  const fmList = applicableFMs
    .map((fm) => `${fm.id} (${fm.severity}): ${fm.name} -- ${fm.description}`)
    .join("\n");

  const userPrompt = `SYSTEM DECOMPOSITION:
${JSON.stringify(decompositionOutput, null, 2)}

APPLICABLE FAILURE MODES FROM KNOWLEDGE BASE:
${fmList}

For each applicable failure mode, produce a MatchedFailureMode entry with the exact
sequence of events that triggers it given this specific decomposition.
Mark the top 5 by risk_score as must_resolve.

Produce JSON matching the AdversarialOutput schema.`;

  return runAgentPass(
    SYSTEM_PROMPT,
    userPrompt,
    AdversarialOutputSchema,
    "Pass3-Adversarial",
  );
}
```
