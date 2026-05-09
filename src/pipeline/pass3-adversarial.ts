import { DecompositionOutput, AdversarialReport, AdversarialReportSchema } from "./schemas";
import { KnowledgeGraph } from "../knowledge/graph";
import { runAgentPass } from "./agent";

const SYSTEM_PROMPT = `You are a Senior Reliability Engineer and security adversary. Your role
is to find every possible way the proposed system design can fail in
production. You do NOT design solutions. You only find failure modes.

Think like a chaos engineer: assume networks are unreliable, clocks drift,
disks fail mid-write, and users send duplicate requests. Your job is to
produce an exhaustive failure mode report.

For each failure mode, you must:
1. Identify the specific service and operation that is vulnerable.
2. Describe the exact sequence of events that causes the failure.
3. State the observable consequence (data loss, incorrect balance, downtime).
4. Reference the matching failure mode from the Knowledge Base if applicable.
5. Score likelihood (HIGH/MEDIUM/LOW) and severity (CRITICAL/HIGH/MEDIUM/LOW).

Hard constraints:
- Do not suggest fixes. ONLY describe failures.
- Every sync interaction generates at least 3 failure scenarios.
- Every async interaction generates at least 3 failure scenarios.
- Output ONLY valid JSON matching the schema. No prose outside the JSON.`;

const WORKED_EXAMPLE = {
  failure_mode_id: "FM-001",
  affected_service: "SVC-PAYMENT",
  affected_operation: "initiateTransfer",
  failure_sequence: [
    "1. Client sends POST /payments with idempotency_key=abc123",
    "2. SVC-PAYMENT processes the charge and commits the ledger entry",
    "3. Network timeout — client never receives 200 response",
    "4. Client retries with same body but no idempotency_key header",
    "5. SVC-PAYMENT processes the charge again — second ledger entry created",
    "6. User is charged twice"
  ],
  observable_consequence: "User balance debited twice. Total system money destroyed.",
  likelihood: "HIGH",
  severity: "CRITICAL",
  risk_score: 9
};

export async function runPass3(
  decompositionOutput: DecompositionOutput,
  knowledgeGraph: KnowledgeGraph,
): Promise<AdversarialReport> {
  const fmList = knowledgeGraph.getAllFailureModes()
    .map((fm) => `${fm.id}: ${fm.name} — ${fm.description}`)
    .join("\n");

  const userPrompt = `SYSTEM DECOMPOSITION:
${JSON.stringify(decompositionOutput, null, 2)}

KNOWLEDGE BASE FAILURE MODES TO CHECK AGAINST:
${fmList}

WORKED EXAMPLE of a failure scenario:
${JSON.stringify(WORKED_EXAMPLE, null, 2)}

Produce the full adversarial report matching the AdversarialReport schema.`;

  return runAgentPass(
    SYSTEM_PROMPT,
    userPrompt,
    AdversarialReportSchema,
    "Pass3-Adversarial",
  );
}
