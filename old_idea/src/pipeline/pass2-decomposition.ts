import { ExtractionOutput, DecompositionOutput, DecompositionOutputSchema } from "./schemas";
import { runAgentPass } from "./agent";

const SYSTEM_PROMPT = `You are a Principal Engineer specializing in domain-driven design and
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
  to resolve them — mark them and the pipeline will surface them.
- Output ONLY valid JSON matching the schema. No prose outside the JSON.`;

export async function runPass2(
  extractionOutput: ExtractionOutput,
): Promise<DecompositionOutput> {
  const userPrompt = `REQUIREMENTS:
${JSON.stringify(extractionOutput, null, 2)}

STANDARD FINTECH BOUNDED CONTEXTS FOR REFERENCE:
Identity, Wallet, Payment, Compliance, Notification, Settlement.
Use these as a starting point. Add, remove, or rename based on the
actual requirements above.

Produce a JSON object matching the DecompositionOutput schema.`;

  const result = await runAgentPass(
    SYSTEM_PROMPT,
    userPrompt,
    DecompositionOutputSchema,
    "Pass2-Decomposition",
  );

  // Validation: circular_dependencies must be empty to proceed to Pass 3
  if (result.circular_dependencies.length > 0) {
    throw new Error(`Circular dependencies detected: ${result.circular_dependencies.map(c => c.nodes.join(" -> ")).join(", ")}`);
  }

  return result;
}
