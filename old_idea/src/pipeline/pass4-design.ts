import {
  ExtractionOutput, DecompositionOutput, AdversarialReport,
  DesignOutput, DesignOutputSchema
} from "./schemas";
import { KnowledgeGraph } from "../knowledge/graph";
import { runAgentPass } from "./agent";

const SYSTEM_PROMPT = `You are a Principal Engineer designing a production-grade financial system.
You receive a requirements object, a service decomposition, and a failure
mode report. Your job is to produce algorithmic designs that satisfy the
requirements AND address every MUST_RESOLVE failure mode.

Hard constraints:
- Every selected pattern must exist in the Knowledge Base. If you select
  a pattern not in the Knowledge Base, mark it as "UNVERIFIED" and explain
  your reasoning. This will pause the pipeline for user review.
- Every algorithm must be expressed as numbered steps. No hand-waving.
  No "handle the error appropriately." Specify exactly what happens.
- Every failure path must be defined. If a step can fail, the algorithm
  must state what happens when it does.
- Concurrency model selection must follow the decision tree:
  (1) Distributed op → Saga. (2) Single resource, high contention →
  Optimistic locking with retry+jitter, max 3 attempts.
  (3) Single resource, low contention → SELECT FOR UPDATE.
  (4) Stateless → no primitive needed.
- Output ONLY valid JSON matching the schema. No prose outside the JSON.`;

const PATTERN_MAPPINGS = `FM-001 → IDEMPOTENCY_KEY (REQUIRES: IDEMPOTENCY_STORE)
FM-002 → ATOMIC_LEDGER_ENTRY (sub-strategy: optimistic or pessimistic)
FM-003 → DOUBLE_ENTRY_LEDGER + SAGA_PATTERN (REQUIRES: COMPENSATING_TRANSACTION)
FM-004 → OUTBOX_PATTERN (REQUIRES: IDEMPOTENT_CONSUMER on receiving side)
FM-005 → CIRCUIT_BREAKER + EXPONENTIAL_BACKOFF
FM-006 → MONETARY_PRECISION (store as BIGINT minor units)
FM-007 → LOGICAL_CLOCK
FM-008 → AUTH_CAPTURE_STATE_MACHINE (REQUIRES: EXPIRY_MONITOR background job)
FM-009 → WEBHOOK_IDEMPOTENCY + HMAC_VERIFICATION
FM-010 → COMPLIANCE_GATE (synchronous, < 50ms target)`;

export async function runPass4(
  extractionOutput: ExtractionOutput,
  decompositionOutput: DecompositionOutput,
  adversarialReport: AdversarialReport,
  knowledgeGraph: KnowledgeGraph,
  violationFeedback?: { invariant: string; trace: string },
): Promise<DesignOutput> {

  const violationSection = violationFeedback
    ? `\n\nFORMAL VERIFICATION VIOLATION FEEDBACK:\nThe following invariant was violated in formal verification:\nINVARIANT: ${violationFeedback.invariant}\nCOUNTEREXAMPLE TRACE:\n${violationFeedback.trace}\nRedesign the algorithm(s) to prevent this exact execution trace.`
    : "";

  const userPrompt = `REQUIREMENTS: ${JSON.stringify(extractionOutput, null, 2)}
DECOMPOSITION: ${JSON.stringify(decompositionOutput, null, 2)}
ADVERSARIAL REPORT: ${JSON.stringify(adversarialReport, null, 2)}

MUST RESOLVE: ${adversarialReport.must_resolve.join(", ")}

KNOWLEDGE BASE PATTERN MAPPINGS:
${PATTERN_MAPPINGS}${violationSection}

Produce the design output matching the DesignOutput schema.`;

  return runAgentPass(
    SYSTEM_PROMPT,
    userPrompt,
    DesignOutputSchema,
    "Pass4-Design",
  );
}
