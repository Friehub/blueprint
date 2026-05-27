import { DesignOutput, Pass5Input, Pass5InputSchema, VerificationOutput } from "./schemas";
import { KnowledgeGraph } from "../knowledge/graph";
import { runAgentPass } from "./agent";
import { generateModels } from "./tla-generator";
import { runTlc, translateTrace } from "./tlc-runner";

const SYSTEM_PROMPT = `You are a formal methods engineer. You receive an algorithmic design and
produce machine-checkable safety invariants in TLA+ syntax.

Hard constraints:
- Extract ONLY safety invariants (properties that must NEVER be violated).
  Do not model liveness or fairness properties — these are out of scope.
- Group invariants by shared variable set. Invariants sharing no variables
  get separate model groups. This prevents state space explosion.
- Every invariant must have a human-readable statement AND a TLA+ assertion.
- Every TLA+ assertion must be syntactically valid TLA+.
- Output ONLY valid JSON matching the schema. No prose outside the JSON.`;

export async function runPass5(
  designOutput: DesignOutput,
  knowledgeGraph: KnowledgeGraph,
): Promise<VerificationOutput> {
  const kbInvariants = knowledgeGraph.getAllFailureModes()
    .map((fm) => `${fm.id}: ${fm.formalInvariant}`)
    .join("\n");

  const userPrompt = `DESIGN OUTPUT:
${JSON.stringify(designOutput, null, 2)}

KNOWLEDGE BASE INVARIANTS (from failure mode register):
${kbInvariants}

Extract invariants and group them into model groups matching the Pass5Input schema.`;

  const pass5Input = await runAgentPass(
    SYSTEM_PROMPT,
    userPrompt,
    Pass5InputSchema,
    "Pass5-InvariantExtraction",
  );

  const generatedModels = await generateModels(pass5Input);

  const tlcResults = await Promise.all(
    generatedModels.map((m) => runTlc(m.modelId, m.tlaPath, m.cfgPath))
  );

  const modelResults = [];
  for (const tlcResult of tlcResults) {
    const group = pass5Input.model_groups.find((g) => g.model_id === tlcResult.modelId)!;
    let translatedTrace: string | undefined;

    if (tlcResult.status === "VIOLATED" && tlcResult.counterexampleTrace) {
      const mainInvariant = group.invariants[0];
      translatedTrace = await translateTrace(
        tlcResult.counterexampleTrace,
        mainInvariant?.statement ?? "Unknown invariant",
      );
    }

    modelResults.push({
      model_id: tlcResult.modelId,
      status: tlcResult.status,
      duration_ms: tlcResult.durationMs,
      verification_bounds: group.bounds,
      counterexample_trace: translatedTrace || tlcResult.counterexampleTrace,
      verified_invariants: group.invariants.map(inv => ({
        ...inv,
        verified: tlcResult.status === "VERIFIED",
        verification_bound: `Verified for ${JSON.stringify(group.bounds)}`
      }))
    });
  }

  const overallStatus = modelResults.every(r => r.status === "VERIFIED") 
    ? "VERIFIED" 
    : modelResults.some(r => r.status === "VIOLATED") ? "VIOLATED" : "PARTIALLY_VERIFIED";

  return {
    models: modelResults as any,
    overall_status: overallStatus as any
  };
}
