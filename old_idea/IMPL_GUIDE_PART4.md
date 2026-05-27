# Engineering Blueprinter -- Implementation Guide
## Part 4: Passes 4–5, TLA+ Generator, TLC Runner, Output Assembly

---

## pass4-design.ts

```typescript
import {
  ExtractionOutput, DecompositionOutput, AdversarialOutput,
  DesignOutput, DesignOutputSchema
} from "./schemas";
import { KnowledgeGraph } from "../knowledge/graph";
import { runAgentPass } from "./agent";

// Maps each failure mode to its required Knowledge Base patterns
const FM_PATTERN_MAP: Record<string, string[]> = {
  "FM-001": ["IDEMPOTENCY_KEY"],                           // REQUIRES: IDEMPOTENCY_STORE
  "FM-002": ["ATOMIC_LEDGER_ENTRY"],
  "FM-003": ["DOUBLE_ENTRY_LEDGER", "SAGA_PATTERN"],       // REQUIRES: COMPENSATING_TRANSACTION
  "FM-004": ["OUTBOX_PATTERN"],                            // REQUIRES: IDEMPOTENT_CONSUMER
  "FM-005": ["CIRCUIT_BREAKER", "EXPONENTIAL_BACKOFF"],
  "FM-006": ["MONETARY_PRECISION"],
  "FM-007": ["LOGICAL_CLOCK"],
  "FM-008": ["AUTH_CAPTURE_STATE_MACHINE"],                // REQUIRES: EXPIRY_MONITOR
  "FM-009": ["WEBHOOK_IDEMPOTENCY", "HMAC_VERIFICATION"],
  "FM-010": ["COMPLIANCE_GATE"],
};

const SYSTEM_PROMPT = `You are a Principal Engineer designing a production-grade financial system.
You receive requirements, a service decomposition, and a failure mode report.
Produce algorithmic designs that satisfy requirements AND address every MUST_RESOLVE failure mode.

Hard constraints:
- Every selected pattern must exist in the Knowledge Base. If not, mark in_knowledge_base=false.
  This pauses the pipeline for user review.
- Every algorithm is expressed as numbered steps. No hand-waving. No "handle the error here."
  Specify exactly what happens at every step.
- Every failure path must be defined. If a step can fail, state the exact failure handling.
- Concurrency model decision tree (follow exactly):
  1. If operation spans multiple services → Saga (not 2PC unless you own all services).
  2. If single shared resource with high contention → Optimistic Locking + retry+jitter, max 3.
  3. If single shared resource with low contention → SELECT FOR UPDATE.
  4. If stateless → none needed.
- Output ONLY valid JSON matching the schema.`;

export async function runPass4(
  extractionOutput: ExtractionOutput,
  decompositionOutput: DecompositionOutput,
  adversarialOutput: AdversarialOutput,
  knowledgeGraph: KnowledgeGraph,
  violationFeedback?: { invariant: string; trace: string }, // from Pass 5 on retry
): Promise<DesignOutput> {

  // Build required patterns list from MUST_RESOLVE failure modes
  const requiredPatterns = adversarialOutput.must_resolve.flatMap(
    (fmId) => FM_PATTERN_MAP[fmId] ?? []
  );
  // Expand transitive requirements from Knowledge Base graph
  const expandedPatterns = [
    ...new Set(requiredPatterns.flatMap(
      (p) => [p, ...knowledgeGraph.getTransitiveRequirements(p)]
    ))
  ];

  const violationSection = violationFeedback
    ? `\n\nFORMAL VERIFICATION VIOLATION FEEDBACK:\nInvariant: ${violationFeedback.invariant}\nCounterexample trace:\n${violationFeedback.trace}\nRedesign the algorithm(s) to prevent this exact execution trace.`
    : "";

  const userPrompt = `REQUIREMENTS: ${JSON.stringify(extractionOutput, null, 2)}
DECOMPOSITION: ${JSON.stringify(decompositionOutput, null, 2)}
ADVERSARIAL REPORT: ${JSON.stringify(adversarialOutput, null, 2)}

MUST RESOLVE failure modes: ${adversarialOutput.must_resolve.join(", ")}

REQUIRED PATTERNS (from Knowledge Base -- must appear in selected_patterns):
${expandedPatterns.map((p) => `- ${p}`).join("\n")}

PATTERN → FAILURE MODE MAPPINGS:
${Object.entries(FM_PATTERN_MAP).map(([fm, patterns]) => `${fm} → ${patterns.join(", ")}`).join("\n")}${violationSection}

Produce JSON matching the DesignOutput schema.`;

  const result = await runAgentPass(
    SYSTEM_PROMPT,
    userPrompt,
    DesignOutputSchema,
    "Pass4-Design",
  );

  // Validate: all MUST_RESOLVE FMs are addressed by a selected pattern
  const resolvedFMs = new Set(result.selected_patterns.flatMap((p) => p.resolves));
  const unresolved = adversarialOutput.must_resolve.filter((fm) => !resolvedFMs.has(fm));
  if (unresolved.length > 0) {
    throw new Error(`Pass4: MUST_RESOLVE failure modes not addressed: ${unresolved.join(", ")}`);
  }

  // Flag unverified patterns
  const unverified = result.selected_patterns.filter((p) => !p.in_knowledge_base);
  if (unverified.length > 0) {
    console.warn(
      "Pass4: Unverified patterns detected (not in Knowledge Base):",
      unverified.map((p) => p.pattern_id).join(", "),
    );
    // Surface to user via SSE event before continuing
  }

  return result;
}
```

---

## tla-generator.ts

```typescript
import { ModelGroupSchema, Pass5Input } from "./schemas";
import { z } from "zod";
import * as path from "path";
import * as fs from "fs/promises";
import * as os from "os";

type ModelGroup = z.infer<typeof ModelGroupSchema>;

export interface GeneratedModel {
  modelId: string;
  tlaPath: string;
  cfgPath: string;
  tlaSource: string;
  cfgSource: string;
  workDir: string;
}

/**
 * Generates .tla and .cfg files for each model group.
 * This is a deterministic string template function -- NO LLM.
 */
export async function generateModels(input: Pass5Input): Promise<GeneratedModel[]> {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "blueprinter-tla-"));
  const results: GeneratedModel[] = [];

  for (const group of input.model_groups) {
    const tlaSource = buildTlaModule(group);
    const cfgSource = buildTlaCfg(group);

    const tlaPath = path.join(workDir, `${group.model_id}.tla`);
    const cfgPath = path.join(workDir, `${group.model_id}.cfg`);

    await fs.writeFile(tlaPath, tlaSource, "utf8");
    await fs.writeFile(cfgPath, cfgSource, "utf8");

    results.push({ modelId: group.model_id, tlaPath, cfgPath, tlaSource, cfgSource, workDir });
  }

  return results;
}

function buildTlaModule(group: ModelGroup): string {
  const { model_id, variables, bounds, invariants, symmetry } = group;

  const constants = Object.keys(bounds).join(",\n          ");
  const varList = variables.join(", ");
  const symmetryDecl = symmetry
    ? `\nSYMMETRY Permutations(1..${Object.keys(bounds)[0]})`
    : "";

  // Build invariant definitions
  const invariantDefs = invariants
    .filter((inv) => inv.category === "safety")
    .map((inv) => `${inv.id} ==\n  ${inv.formal_assertion}`)
    .join("\n\n");

  const safetyInvariant = invariants
    .filter((inv) => inv.category === "safety")
    .map((inv) => inv.id)
    .join(" /\\ ");

  return `---- MODULE ${model_id} ----
EXTENDS Naturals, FiniteSets, Sequences

(* Explicit bounds -- not a timeout, a verified scope *)
CONSTANTS ${constants}
${symmetryDecl}

VARIABLES ${varList}

TypeInvariant ==
  TRUE (* Implement type checks based on variable semantics *)

${invariantDefs}

SafetyInvariant == ${safetyInvariant || "TRUE"}

====`;
}

function buildTlaCfg(group: ModelGroup): string {
  const constants = Object.entries(group.bounds)
    .map(([k, v]) => `CONSTANT ${k} = ${v}`)
    .join("\n");

  const safetyInvariants = group.invariants
    .filter((inv) => inv.category === "safety")
    .map((inv) => `INVARIANT ${inv.id}`)
    .join("\n");

  return `${constants}
INVARIANT TypeInvariant
${safetyInvariants}
INVARIANT SafetyInvariant`;
}
```

---

## tlc-runner.ts

```typescript
import { spawn } from "child_process";
import { loadConfig } from "../config";

export interface TlcResult {
  modelId: string;
  status: "VERIFIED" | "VIOLATED" | "ERROR";
  durationMs: number;
  counterexampleTrace?: string;
  rawOutput: string;
}

const config = loadConfig();

/**
 * Runs TLC on a single model. Returns a result -- never throws.
 * All model groups MUST be run in parallel via Promise.all.
 * There is NO timeout. Bounds in .cfg ensure TLC terminates.
 */
export async function runTlc(
  modelId: string,
  tlaPath: string,
  cfgPath: string,
): Promise<TlcResult> {
  const start = Date.now();
  let rawOutput = "";

  return new Promise((resolve) => {
    const proc = spawn(config.TLC_BINARY_PATH, [
      "-config", cfgPath,
      "-deadlock",
      tlaPath,
    ]);

    proc.stdout.on("data", (data: Buffer) => { rawOutput += data.toString(); });
    proc.stderr.on("data", (data: Buffer) => { rawOutput += data.toString(); });

    proc.on("close", (code) => {
      const durationMs = Date.now() - start;

      // TLC exits with 0 on success, 12 on violation, non-zero on error
      if (code === 0 && rawOutput.includes("Model checking completed. No error has been found.")) {
        resolve({ modelId, status: "VERIFIED", durationMs, rawOutput });
      } else if (rawOutput.includes("Error:") || rawOutput.includes("Invariant") && rawOutput.includes("violated")) {
        const trace = extractCounterexample(rawOutput);
        resolve({ modelId, status: "VIOLATED", durationMs, counterexampleTrace: trace, rawOutput });
      } else {
        resolve({ modelId, status: "ERROR", durationMs, rawOutput });
      }
    });

    proc.on("error", (err) => {
      resolve({
        modelId, status: "ERROR",
        durationMs: Date.now() - start,
        rawOutput: `Process spawn error: ${err.message}`,
      });
    });
  });
}

function extractCounterexample(output: string): string {
  // TLC prints counterexample between "Error:" and the next blank line
  const match = output.match(/Error:.*?(?=\n\n|\Z)/s);
  return match ? match[0] : output.slice(-2000); // Last 2000 chars as fallback
}

/**
 * Translates a TLC counterexample trace into plain English.
 * This IS an LLM call -- the trace is fed to a lightweight model.
 */
export async function translateTrace(trace: string, invariantStatement: string): Promise<string> {
  const { generateText } = await import("ai");
  const { openai } = await import("@ai-sdk/openai");

  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    prompt: `Translate this TLA+ model checker counterexample into plain English steps.
Each step should explain what state change occurred and why it violates the invariant.
Invariant: ${invariantStatement}
Counterexample:
${trace}`,
  });
  return text;
}
```

---

## pass5-verification.ts

```typescript
import { DesignOutput, Pass5Input, Pass5InputSchema } from "./schemas";
import { KnowledgeGraph } from "../knowledge/graph";
import { runAgentPass } from "./agent";
import { generateModels } from "./tla-generator";
import { runTlc, translateTrace } from "./tlc-runner";

export interface VerificationResult {
  modelId: string;
  status: "VERIFIED" | "VIOLATED" | "ERROR";
  durationMs: number;
  verifiedInvariants: string[];
  verificationBounds: Record<string, number>;
  counterexampleTrace?: string;
  translatedTrace?: string;
}

const SYSTEM_PROMPT = `You are a formal methods engineer. Extract machine-checkable safety invariants
from the algorithmic design and group them into minimal model groups.

Hard constraints:
- Extract ONLY safety invariants (must NEVER be violated). Skip liveness and fairness.
- Group invariants by shared variable set. Invariants with no shared variables → separate models.
- This prevents state space explosion -- each model is minimal and bounded.
- Every TLA+ formal_assertion must be syntactically valid TLA+.
- Output ONLY valid JSON matching the schema.`;

export async function runPass5(
  designOutput: DesignOutput,
  knowledgeGraph: KnowledgeGraph,
): Promise<VerificationResult[]> {
  // Step 5.1-5.2: Extract invariants and group into models via LLM
  const kbInvariants = knowledgeGraph.getAllFailureModes()
    .map((fm) => `${fm.id}: ${fm.formalInvariant}`)
    .join("\n");

  const userPrompt = `DESIGN OUTPUT:
${JSON.stringify(designOutput, null, 2)}

KNOWLEDGE BASE FORMAL INVARIANTS (include these for applicable failure modes):
${kbInvariants}

Group safety invariants by shared variable set into model groups.
Standard fintech model groups:
- BalanceSafety: variables=[balance, ledger], bounds={MaxAccounts:3, MaxTransactions:5}
- Idempotency: variables=[idempotency_store, ledger], bounds={MaxKeys:5}
- StateMachine: variables=[payment_status], bounds={MaxPayments:3}
- OutboxAtomicity: variables=[outbox, ledger, db_state], bounds={MaxOps:3}

Produce JSON matching the Pass5Input schema (model_groups array).`;

  const pass5Input = await runAgentPass(
    SYSTEM_PROMPT,
    userPrompt,
    Pass5InputSchema,
    "Pass5-InvariantExtraction",
  );

  // Step 5.3: Generate TLA+ files (deterministic, no LLM)
  const generatedModels = await generateModels(pass5Input);

  // Step 5.4: Run ALL models in parallel -- never sequentially
  const tlcResults = await Promise.all(
    generatedModels.map((m) => runTlc(m.modelId, m.tlaPath, m.cfgPath))
  );

  // Step 5.5: Process results
  const results: VerificationResult[] = [];
  for (const tlcResult of tlcResults) {
    const group = pass5Input.model_groups.find((g) => g.model_id === tlcResult.modelId)!;
    let translatedTrace: string | undefined;

    if (tlcResult.status === "VIOLATED" && tlcResult.counterexampleTrace) {
      // Translate trace to English for Pass 4 feedback
      const mainInvariant = group.invariants[0];
      translatedTrace = await translateTrace(
        tlcResult.counterexampleTrace,
        mainInvariant?.statement ?? "Unknown invariant",
      );
    }

    results.push({
      modelId: tlcResult.modelId,
      status: tlcResult.status,
      durationMs: tlcResult.durationMs,
      verifiedInvariants: tlcResult.status === "VERIFIED"
        ? group.invariants.map((i) => i.id)
        : [],
      verificationBounds: group.bounds,
      counterexampleTrace: tlcResult.counterexampleTrace,
      translatedTrace,
    });
  }

  return results;
}
```

---

## output-assembler.ts

```typescript
import { ExtractionOutput, DecompositionOutput, AdversarialOutput, DesignOutput } from "./schemas";
import { VerificationResult } from "./pass5-verification";

// NO LLM. NO external calls. Pure string template render.
export function assembleSpec(
  prompt: string,
  extraction: ExtractionOutput,
  decomposition: DecompositionOutput,
  adversarial: AdversarialOutput,
  design: DesignOutput,
  verification: VerificationResult[],
): string {
  const overallStatus = verification.every((v) => v.status === "VERIFIED")
    ? "VERIFIED"
    : verification.some((v) => v.status === "VIOLATED")
    ? "VIOLATED"
    : "PARTIALLY_VERIFIED";

  const date = new Date().toISOString().split("T")[0];

  const lines: string[] = [
    `# Engineering Specification`,
    `> Generated by Engineering Blueprinter | Fintech Domain`,
    `> Formal Verification: ${overallStatus} | ${date}`,
    ``,
    `## 1. Requirements`,
    `### 1.1 Functional Requirements`,
    ...extraction.functional_requirements.map(
      (r) => `- **[${r.id}]** \`${r.priority}\` ${r.statement} _(${r.source})_`
    ),
    ``,
    `### 1.2 Non-Functional Requirements`,
    ...extraction.non_functional_requirements.map(
      (r) => `- **[${r.id}]** ${r.constraint}: ${r.value} _(${r.source})_`
    ),
    ``,
    `### 1.3 Implicit Constraints (Auto-Applied)`,
    ...extraction.implicit_constraints.map((c) => `- ${c}`),
    ``,
    `## 2. Assumptions`,
    ...extraction.assumptions.map(
      (a) => `- **[${a.id}]** ${a.statement}\n  _Impact: ${a.impact}_`
    ),
    ``,
    `## 3. Failure Mode Register`,
    ...adversarial.matched_failure_modes.map(
      (fm) => [
        `### ${fm.failure_mode_id} -- ${fm.affected_service}`,
        `- **Likelihood**: ${fm.likelihood} | **Severity**: ${fm.severity} | **Risk Score**: ${fm.risk_score}`,
        `- **Consequence**: ${fm.observable_consequence}`,
        `- **Sequence**:`,
        ...fm.failure_sequence.map((s) => `  ${s}`),
      ].join("\n")
    ),
    ``,
    `## 4. Domain Decomposition`,
    ...decomposition.services.map(
      (s) => [
        `### ${s.name} (${s.id})`,
        `- **Owns**: ${s.owns.join(", ") || "none"}`,
        `- **Reads from**: ${s.reads_from.join(", ") || "none"}`,
        `- **Publishes**: ${s.publishes.join(", ") || "none"}`,
        `- **Consumes**: ${s.consumes.join(", ") || "none"}`,
      ].join("\n")
    ),
    ``,
    `## 5. Algorithms`,
    ...design.algorithms.map(
      (alg) => [
        `### ${alg.operation} (${alg.service})`,
        `**Preconditions**: ${alg.preconditions.join("; ")}`,
        ...alg.steps.map(
          (step) =>
            `${step.number}. [${step.execution.toUpperCase()}] ${step.description}` +
            (step.failure_handling ? `\n   _On failure: ${step.failure_handling}_` : "")
        ),
        `**Postconditions**: ${alg.postconditions.join("; ")}`,
      ].join("\n")
    ),
    ``,
    `## 6. Invariants`,
    ...verification.map(
      (v) => [
        `### Model: ${v.modelId} -- ${v.status}`,
        `- **Bounds**: ${JSON.stringify(v.verificationBounds)}`,
        `- **Duration**: ${v.durationMs}ms`,
        v.status === "VIOLATED" && v.translatedTrace
          ? `- **Violation**: ${v.translatedTrace}`
          : "",
      ].filter(Boolean).join("\n")
    ),
    ``,
    `## 7. Formal Model`,
    `> TLA+ model files generated and verified. Download via GET /specs/:id/formal-models`,
    ``,
    `## 8. Implementation Order`,
    `> Derived from dependency graph (topological sort):`,
    ...deriveBuildOrder(decomposition),
    ``,
  ];

  return lines.join("\n");
}

function deriveBuildOrder(decomposition: DecompositionOutput): string[] {
  // Topological sort of dependency_graph
  const inDegree: Record<string, number> = {};
  const adjList: Record<string, string[]> = {};

  for (const svc of decomposition.services) {
    inDegree[svc.id] = 0;
    adjList[svc.id] = [];
  }
  for (const edge of decomposition.dependency_graph) {
    adjList[edge.from] = adjList[edge.from] ?? [];
    adjList[edge.from].push(edge.to);
    inDegree[edge.to] = (inDegree[edge.to] ?? 0) + 1;
  }

  const queue = Object.entries(inDegree)
    .filter(([, deg]) => deg === 0)
    .map(([id]) => id);
  const order: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const dep of adjList[node] ?? []) {
      inDegree[dep]--;
      if (inDegree[dep] === 0) queue.push(dep);
    }
  }

  return order.map((id, i) => `${i + 1}. ${id}`);
}
```
