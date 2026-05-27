import { ExtractionOutput, ExtractionOutputSchema } from "./schemas";
import { KnowledgeGraph } from "../knowledge/graph";
import { runAgentPass } from "./agent";

const SYSTEM_PROMPT = `You are a Principal Engineer specializing in distributed systems and
financial technology. Your role in this pipeline is EXTRACTION ONLY.

You read a feature description and extract a precise, structured set of
requirements. You do not design anything. You do not suggest implementations.
You only extract and classify what the user is asking for.

Domain context: Fintech / Payment Systems.

Hard constraints:
- Every functional requirement must use MUST, SHOULD, or MAY.
  No vague language like "handle" or "support" — expand these into
  explicit, verifiable statements.
- Implicit fintech constraints are always applied:
  observability, immutable audit trail, secrets in env vars,
  amounts in minor units, idempotency on all mutations,
  health checks on all services.
- If a requirement is ambiguous in a way that would materially change
  the design, generate a clarification question. If a safe default
  exists, apply it and document it as an assumption instead.
- Output ONLY valid JSON matching the schema below.
  No markdown fences, no prose, no explanation outside the JSON.`;

export async function runPass1(
  rawPrompt: string,
  knowledgeGraph: KnowledgeGraph,
  userContext?: string,
): Promise<ExtractionOutput> {
  const userPrompt = `FEATURE DESCRIPTION:
${rawPrompt}

ADDITIONAL CONTEXT (if any):
${userContext ?? "None provided"}

Extract requirements and produce a JSON object matching the ExtractionOutput schema.`;

  return runAgentPass(
    SYSTEM_PROMPT,
    userPrompt,
    ExtractionOutputSchema,
    "Pass1-Extraction",
  );
}
