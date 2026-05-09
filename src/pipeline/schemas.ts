import { z } from "zod";

// ── Shared Primitives ────────────────────────────────────────────────────────

export const PrioritySchema = z.enum(["MUST", "SHOULD", "MAY"]);
export const LikelihoodSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const SeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

// ── Pass 1: Extraction ───────────────────────────────────────────────────────

export const FunctionalRequirementSchema = z.object({
  id: z.string(),           // e.g., "FR-001"
  statement: z.string(),    // "The system MUST..."
  priority: PrioritySchema,
  source: z.enum(["explicit", "inferred"]),
});

export const NFRRequirementSchema = z.object({
  id: z.string(),
  constraint: z.string(),
  value: z.string(),
  source: z.enum(["explicit", "default_applied"]),
});

export const AssumptionSchema = z.object({
  id: z.string(),           // e.g., "A-001"
  statement: z.string(),
  impact: z.string(),
});

export const ClarificationQuestionSchema = z.object({
  id: z.string(),           // e.g., "CQ-001"
  question: z.string(),
  design_impact: z.string(),
  blocking: z.boolean(),
});

export const ExtractionOutputSchema = z.object({
  functional_requirements: z.array(FunctionalRequirementSchema).min(1),
  non_functional_requirements: z.array(NFRRequirementSchema),
  implicit_constraints: z.array(z.string()),
  assumptions: z.array(AssumptionSchema).min(1),
  clarification_questions: z.array(ClarificationQuestionSchema),
});

export type ExtractionOutput = z.infer<typeof ExtractionOutputSchema>;
export type FunctionalRequirement = z.infer<typeof FunctionalRequirementSchema>;
export type ClarificationQuestion = z.infer<typeof ClarificationQuestionSchema>;

// ── Pass 2: Decomposition ────────────────────────────────────────────────────

export const ServiceSchema = z.object({
  id: z.string(),           // e.g., "SVC-PAYMENT"
  name: z.string(),
  owns: z.array(z.string()),
  reads_from: z.array(z.string()),
  publishes: z.array(z.string()),
  consumes: z.array(z.string()),
});

export const DependencyEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: z.enum(["sync", "async"]),
});

export const InteractionSchema = z.object({
  caller: z.string().optional(),
  callee: z.string().optional(),
  publisher: z.string().optional(),
  event: z.string().optional(),
  consumers: z.array(z.string()).optional(),
  purpose: z.string().optional(),
  sla_ms: z.number().optional(),
});

export const CircularDependencySchema = z.object({
  nodes: z.array(z.string()),
  suggested_resolution: z.string(),
});

export const DecompositionOutputSchema = z.object({
  services: z.array(ServiceSchema).min(1),
  dependency_graph: z.array(DependencyEdgeSchema),
  sync_interactions: z.array(InteractionSchema),
  async_interactions: z.array(InteractionSchema),
  circular_dependencies: z.array(CircularDependencySchema),
});

export type DecompositionOutput = z.infer<typeof DecompositionOutputSchema>;

// ── Pass 3: Adversarial ──────────────────────────────────────────────────────

export const MatchedFailureModeSchema = z.object({
  failure_mode_id: z.string(),
  affected_service: z.string(),
  affected_operation: z.string().optional(),
  failure_sequence: z.array(z.string()).optional(), // from PIPELINE.md example
  observable_consequence: z.string().optional(),
  likelihood: LikelihoodSchema,
  severity: SeveritySchema,
  risk_score: z.number(),
});

export const SequenceFailureSchema = z.object({
  interaction_id: z.string().optional(),
  trigger: z.string(),
  consequence: z.string(),
  mitigation_required: z.boolean(),
});

export const AdversarialReportSchema = z.object({
  matched_failure_modes: z.array(MatchedFailureModeSchema),
  sequence_failures: z.array(SequenceFailureSchema),
  must_resolve: z.array(z.string()),   // failure mode IDs
  should_resolve: z.array(z.string()), // failure mode IDs
});

export type AdversarialReport = z.infer<typeof AdversarialReportSchema>;

// ── Pass 4: Design ───────────────────────────────────────────────────────────

export const AlgorithmStepSchema = z.object({
  number: z.number(),
  description: z.string(),
  execution: z.enum(["sync", "async"]),
  can_fail: z.boolean(),
  failure_handling: z.string().optional(),
});

export const AlgorithmSchema = z.object({
  operation: z.string(),
  service: z.string(),
  preconditions: z.array(z.string()),
  steps: z.array(AlgorithmStepSchema).min(1),
  postconditions: z.array(z.string()),
  failure_paths: z.array(z.object({
    trigger: z.string(),
    response: z.string(),
  })).min(1),
});

export const SelectedPatternSchema = z.object({
  pattern_id: z.string(),
  resolves: z.array(z.string()),
  in_knowledge_base: z.boolean(),
  justification: z.string(),
});

export const DesignOutputSchema = z.object({
  selected_patterns: z.array(SelectedPatternSchema),
  concurrency_model: z.object({
    strategy: z.enum(["optimistic_locking", "pessimistic_locking", "saga", "none"]),
    justification: z.string(),
  }),
  algorithms: z.array(AlgorithmSchema).min(1),
  conflict_resolutions: z.array(z.object({
    pattern_a: z.string(),
    pattern_b: z.string(),
    resolution: z.string(),
  })),
});

export type DesignOutput = z.infer<typeof DesignOutputSchema>;

// ── Pass 5: Verification ─────────────────────────────────────────────────────

export const InvariantSchema = z.object({
  id: z.string(),
  statement: z.string(),
  formal_assertion: z.string(),
  category: z.enum(["safety", "liveness", "fairness"]),
  verified: z.boolean(),
  verification_bound: z.string().optional(),
  source: z.string(),
});

export const ModelResultSchema = z.object({
  model_id: z.string(),
  tla_source_path: z.string().optional(),
  cfg_path: z.string().optional(),
  verified_invariants: z.array(InvariantSchema),
  status: z.enum(["VERIFIED", "VIOLATED", "ERROR"]),
  verification_bounds: z.record(z.string(), z.number()),
  counterexample_trace: z.string().optional(),
  duration_ms: z.number(),
});

export const VerificationOutputSchema = z.object({
  models: z.array(ModelResultSchema),
  overall_status: z.enum(["VERIFIED", "VIOLATED", "PARTIALLY_VERIFIED", "ERROR"]),
});

export type VerificationOutput = z.infer<typeof VerificationOutputSchema>;

// ── Pass 5 Internal (LLM Input) ─────────────────────────────────────────────

export const ModelGroupSchema = z.object({
  model_id: z.string(),
  variables: z.array(z.string()),
  symmetry: z.string().optional(),
  bounds: z.record(z.string(), z.number()),
  invariants: z.array(z.object({
    id: z.string(),
    statement: z.string(),
    formal_assertion: z.string(),
    category: z.enum(["safety", "liveness", "fairness"]),
    source: z.string(),
  })).min(1),
});

export const Pass5InputSchema = z.object({
  model_groups: z.array(ModelGroupSchema).min(1),
});

export type Pass5Input = z.infer<typeof Pass5InputSchema>;
