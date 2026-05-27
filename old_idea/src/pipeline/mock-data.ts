import { ExtractionOutput, DecompositionOutput, AdversarialReport, DesignOutput, VerificationOutput } from "./schemas";

/**
 * Provides high-quality mock data for the reasoning pipeline.
 * Used when no API key is provided (ebp_test_ token).
 */
export const MOCK_DATA = {
  extraction: {
    functional_requirements: [
      { id: "FR-001", statement: "The system MUST accept payment initiation requests.", priority: "MUST", source: "explicit" },
      { id: "FR-002", statement: "The system MUST authorize payments with external processors.", priority: "MUST", source: "explicit" },
      { id: "FR-003", statement: "The system MUST record all ledger entries in a double-entry format.", priority: "MUST", source: "inferred" }
    ],
    non_functional_requirements: [
      { id: "NFR-001", constraint: "Throughput", value: "100 TPS", source: "default_applied" }
    ],
    implicit_constraints: [
      "All monetary values stored as integer minor units.",
      "Idempotency on all mutations."
    ],
    assumptions: [
      { id: "A-001", statement: "Assumes 99.9% availability of the payment processor.", impact: "Saga patterns required for resilience." }
    ],
    clarification_questions: []
  } as ExtractionOutput,

  decomposition: {
    services: [
      { id: "SVC-WALLET", name: "Wallet Service", owns: ["accounts", "ledger"], reads_from: [], publishes: ["balance.updated"], consumes: [] },
      { id: "SVC-PAYMENT", name: "Payment Service", owns: ["payments"], reads_from: ["SVC-WALLET"], publishes: ["payment.completed"], consumes: [] }
    ],
    dependency_graph: [{ from: "SVC-PAYMENT", to: "SVC-WALLET", type: "sync" }],
    sync_interactions: [{ caller: "SVC-PAYMENT", callee: "SVC-WALLET", purpose: "Balance Check", sla_ms: 100 }],
    async_interactions: [],
    circular_dependencies: []
  } as DecompositionOutput,

  adversarial: {
    matched_failure_modes: [
      { failure_mode_id: "FM-001", affected_service: "SVC-PAYMENT", likelihood: "HIGH", severity: "CRITICAL", risk_score: 9 }
    ],
    sequence_failures: [],
    must_resolve: ["FM-001"],
    should_resolve: []
  } as AdversarialReport,

  design: {
    selected_patterns: [
      { pattern_id: "IDEMPOTENCY_KEY", resolves: ["FM-001"], in_knowledge_base: true, justification: "Prevents double charge." }
    ],
    concurrency_model: { strategy: "optimistic_locking", justification: "High throughput balance updates." },
    algorithms: [
      {
        operation: "Transfer Funds",
        service: "SVC-PAYMENT",
        preconditions: ["amount > 0"],
        steps: [
          { number: 1, description: "Check Idempotency", execution: "sync", can_fail: true },
          { number: 2, description: "Deduct Balance", execution: "sync", can_fail: true }
        ],
        postconditions: ["Ledger sum is zero"],
        failure_paths: [{ trigger: "Insufficient funds", response: "Abort" }]
      }
    ],
    conflict_resolutions: []
  } as DesignOutput,

  verification: {
    models: [
      {
        model_id: "BalanceSafety",
        status: "VERIFIED",
        duration_ms: 120,
        verification_bounds: { MaxAccounts: 3 },
        verified_invariants: [
          { id: "INV-001", statement: "Balance >= 0", formal_assertion: "\\A a: balance[a] >= 0", category: "safety", verified: true, source: "FM-002" }
        ]
      }
    ],
    overall_status: "VERIFIED"
  } as VerificationOutput
};
