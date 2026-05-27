import { KnowledgeGraph } from "../knowledge/graph";
import { runPass1 } from "./pass1-extraction";
import { evaluateGate, pauseForClarification } from "./clarification-gate";
import { runPass2 } from "./pass2-decomposition";
import { runPass3 } from "./pass3-adversarial";
import { runPass4 } from "./pass4-design";
import { runPass5 } from "./pass5-verification";
import { assembleSpec } from "./output-assembler";
import { generateScaffold } from "./scaffolder";
import { SseEmitter } from "../api/sse";
import * as storage from "../storage";

export interface RunOptions {
  specRunId: string;
  prompt: string;
  userContext?: string;
  knowledgeGraph: KnowledgeGraph;
  emitter: SseEmitter;
  reusedPasses?: number[]; // IDs of passes to skip/reuse from parent_spec_id
  scaffoldTarget?: "typescript-node" | "rust-axum" | "solidity";
}

/**
 * Main pipeline execution. Runs all passes in order.
 * Implements the full feedback loop and deterministic output assembly.
 */
export async function runPipeline(opts: RunOptions): Promise<void> {
  const { specRunId, prompt, userContext, knowledgeGraph, emitter, scaffoldTarget } = opts;
  const MAX_REDESIGN_ITERATIONS = 3;
  const startTime = Date.now();

  try {
    // ── PASS 1: Extraction ───────────────────────────────────────────────────
    emitter.emit(specRunId, "pass_started", { pass: 1, name: "Extraction" });
    const p1Start = Date.now();
    const extraction = await runPass1(prompt, knowledgeGraph, userContext);
    await storage.passOutputs.save(specRunId, 1, extraction);
    emitter.emit(specRunId, "pass_completed", { 
      pass: 1, name: "Extraction", 
      duration_ms: Date.now() - p1Start 
    });

    // ── CLARIFICATION GATE ───────────────────────────────────────────────────
    const gateStatus = evaluateGate(extraction);
    if (gateStatus === "blocking") {
      emitter.emit(specRunId, "clarification_required", {
        spec_id: specRunId,
        questions: extraction.clarification_questions.filter(q => q.blocking),
        timeout_seconds: 300,
      });
      await pauseForClarification(specRunId, extraction.clarification_questions);
      return; 
    }

    // ── PASS 2: Decomposition ────────────────────────────────────────────────
    emitter.emit(specRunId, "pass_started", { pass: 2, name: "Decomposition" });
    const p2Start = Date.now();
    const decomposition = await runPass2(extraction);
    await storage.passOutputs.save(specRunId, 2, decomposition);
    emitter.emit(specRunId, "pass_completed", { pass: 2, duration_ms: Date.now() - p2Start });

    // ── PASS 3: Adversarial ──────────────────────────────────────────────────
    emitter.emit(specRunId, "pass_started", { pass: 3, name: "Adversarial" });
    const p3Start = Date.now();
    const adversarial = await runPass3(decomposition, knowledgeGraph);
    await storage.passOutputs.save(specRunId, 3, adversarial);
    emitter.emit(specRunId, "pass_completed", { pass: 3, duration_ms: Date.now() - p3Start });

    // ── PASS 4 & 5: Design & Verification Feedback Loop ──────────────────────
    let iteration = 0;
    let design = await runPass4(extraction, decomposition, adversarial, knowledgeGraph);
    let verification = await runPass5(design, knowledgeGraph);

    while (iteration < MAX_REDESIGN_ITERATIONS && verification.overall_status === "VIOLATED") {
      iteration++;
      const violatedModel = verification.models.find(m => m.status === "VIOLATED");
      if (!violatedModel) break;

      emitter.emit(specRunId, "redesign_started", { 
        iteration, 
        violated_invariant: violatedModel.verified_invariants.find(i => !i.verified)?.statement 
      });

      design = await runPass4(extraction, decomposition, adversarial, knowledgeGraph, {
        invariant: violatedModel.verified_invariants.find(i => !i.verified)?.statement ?? "Unknown",
        trace: violatedModel.counterexample_trace ?? "No trace captured"
      });
      verification = await runPass5(design, knowledgeGraph);
    }

    await storage.passOutputs.save(specRunId, 4, design);
    await storage.passOutputs.save(specRunId, 5, verification);

    // ── FINAL CHECKS ─────────────────────────────────────────────────────────
    if (verification.overall_status === "VIOLATED") {
      await storage.specRuns.setFailed(specRunId, "UNRESOLVABLE_DESIGN_CONFLICT");
      emitter.emit(specRunId, "failed", { error: "UNRESOLVABLE_DESIGN_CONFLICT" });
      return;
    }

    // ── SCAFFOLD GENERATION ──────────────────────────────────────────────────
    let scaffoldFiles = [];
    if (scaffoldTarget) {
      emitter.emit(specRunId, "pass_started", { pass: "scaffold", name: "Scaffolding" });
      scaffoldFiles = await generateScaffold(scaffoldTarget, decomposition, design);
      emitter.emit(specRunId, "pass_completed", { pass: "scaffold", name: "Scaffolding" });
    }

    // ── OUTPUT ASSEMBLY ──────────────────────────────────────────────────────
    const markdown = assembleSpec(prompt, extraction, decomposition, adversarial, design, verification, scaffoldFiles);
    await storage.renderedSpecs.save(specRunId, markdown);
    await storage.specRuns.setCompleted(specRunId, Date.now() - startTime);

    emitter.emit(specRunId, "completed", {
      spec_id: specRunId,
      status: "completed",
      overall_verification: verification.overall_status,
      spec_url: `/v1/specs/${specRunId}/result`
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await storage.specRuns.setFailed(specRunId, msg);
    emitter.emit(specRunId, "failed", { error: msg });
  }
}
