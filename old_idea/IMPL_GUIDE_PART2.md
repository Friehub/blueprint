# Engineering Blueprinter — Implementation Guide
## Part 2: Data Models, Zod Schemas, and Knowledge Base

---

## config.ts

```typescript
import { z } from "zod";

const ConfigSchema = z.object({
  DATABASE_URL: z.string().url(),
  OPENAI_API_KEY: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  TLC_BINARY_PATH: z.string().default("/usr/local/bin/tlc"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    console.error("FATAL: Invalid configuration:", result.error.format());
    process.exit(1);
  }
  return result.data;
}
```

---

## knowledge/types.ts

```typescript
export type EdgeType = "REQUIRES" | "CONFLICTS_WITH" | "SOLVES" | "INTRODUCES" | "SUPERSEDED_BY";

export interface KnowledgeNode {
  id: string;           // e.g., "IDEMPOTENCY_KEY"
  category: string;     // e.g., "Reliability Pattern"
  description: string;
  solves: string[];     // failure mode IDs this node solves, e.g., ["FM-001"]
  requires: string[];   // other node IDs required when this is used
  introduces: string[]; // new problems introduced
  conflictsWith: string[];
}

export interface FailureMode {
  id: string;           // e.g., "FM-001"
  name: string;         // e.g., "Double Charge"
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  formalInvariant: string;
  requiredMitigation: string; // node ID that solves this
}

export interface ImplicitConstraint {
  id: string;
  statement: string;
}
```

---

## knowledge/graph.ts

```typescript
import { KnowledgeNode, FailureMode, ImplicitConstraint } from "./types";

export class KnowledgeGraph {
  private nodes: Map<string, KnowledgeNode> = new Map();
  private failureModes: Map<string, FailureMode> = new Map();
  private implicitConstraints: ImplicitConstraint[] = [];

  addNode(node: KnowledgeNode): void {
    this.nodes.set(node.id, node);
  }

  addFailureMode(fm: FailureMode): void {
    this.failureModes.set(fm.id, fm);
  }

  getNode(id: string): KnowledgeNode | undefined {
    return this.nodes.get(id);
  }

  getFailureMode(id: string): FailureMode | undefined {
    return this.failureModes.get(id);
  }

  getAllFailureModes(): FailureMode[] {
    return Array.from(this.failureModes.values());
  }

  getImplicitConstraints(): ImplicitConstraint[] {
    return this.implicitConstraints;
  }

  setImplicitConstraints(c: ImplicitConstraint[]): void {
    this.implicitConstraints = c;
  }

  /**
   * Given a node ID, return all nodes transitively REQUIRED by it.
   * Used in Pass 4 to auto-pull in dependencies when a pattern is selected.
   */
  getTransitiveRequirements(nodeId: string, visited = new Set<string>()): string[] {
    if (visited.has(nodeId)) return [];
    visited.add(nodeId);
    const node = this.nodes.get(nodeId);
    if (!node) return [];
    const reqs: string[] = [...node.requires];
    for (const req of node.requires) {
      reqs.push(...this.getTransitiveRequirements(req, visited));
    }
    return [...new Set(reqs)];
  }

  /**
   * Given two node IDs, check if they conflict.
   * Used in Pass 4 Step 4.4 conflict check.
   */
  conflicts(nodeA: string, nodeB: string): boolean {
    const a = this.nodes.get(nodeA);
    return a?.conflictsWith.includes(nodeB) ?? false;
  }

  /**
   * Validate graph consistency. Call at startup after loading.
   * Returns list of errors. Empty array = graph is valid.
   */
  validate(): string[] {
    const errors: string[] = [];
    for (const [id, node] of this.nodes) {
      // All REQUIRES targets must exist
      for (const req of node.requires) {
        if (!this.nodes.has(req)) {
          errors.push(`Node ${id} REQUIRES unknown node ${req}`);
        }
      }
      // No circular REQUIRES (simple check — full DFS if needed)
      if (node.requires.includes(id)) {
        errors.push(`Node ${id} has circular REQUIRES (self-reference)`);
      }
      // All SOLVES targets must exist as failure modes
      for (const solves of node.solves) {
        if (!this.failureModes.has(solves)) {
          errors.push(`Node ${id} SOLVES unknown failure mode ${solves}`);
        }
      }
    }
    return errors;
  }
}
```

---

## pipeline/schemas.ts — All Pass I/O Schemas

This file is the pipeline's contract. Every pass imports its schema from here.

```typescript
import { z } from "zod";

// ── Shared primitives ────────────────────────────────────────────────────────

const PrioritySchema = z.enum(["MUST", "SHOULD", "MAY"]);
const LikelihoodSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
const SeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

// ── Pass 1: Extraction ───────────────────────────────────────────────────────

export const FunctionalRequirementSchema = z.object({
  id: z.string(),                           // e.g., "FR-001"
  statement: z.string(),                    // "The system MUST..."
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
  id: z.string(),
  statement: z.string(),
  impact: z.string(),
});

export const ClarificationQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  design_impact: z.string(),
  blocking: z.boolean(),
});

export const ExtractionOutputSchema = z.object({
  functional_requirements: z.array(FunctionalRequirementSchema).min(1),
  non_functional_requirements: z.array(NFRRequirementSchema),
  implicit_constraints: z.array(z.string()),
  assumptions: z.array(AssumptionSchema).min(1), // Always at least scale defaults
  clarification_questions: z.array(ClarificationQuestionSchema),
});

export type ExtractionOutput = z.infer<typeof ExtractionOutputSchema>;

// ── Pass 2: Decomposition ────────────────────────────────────────────────────

export const ServiceSchema = z.object({
  id: z.string(),         // e.g., "SVC-PAYMENT"
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

export const DecompositionOutputSchema = z.object({
  services: z.array(ServiceSchema).min(1),
  dependency_graph: z.array(DependencyEdgeSchema),
  sync_interactions: z.array(InteractionSchema),
  async_interactions: z.array(InteractionSchema),
  circular_dependencies: z.array(z.string()).max(0, {
    message: "Circular dependencies must be resolved before proceeding",
  }),
});

export type DecompositionOutput = z.infer<typeof DecompositionOutputSchema>;

// ── Pass 3: Adversarial ──────────────────────────────────────────────────────

export const MatchedFailureModeSchema = z.object({
  failure_mode_id: z.string(),
  affected_service: z.string(),
  affected_operation: z.string().optional(),
  failure_sequence: z.array(z.string()),
  observable_consequence: z.string(),
  likelihood: LikelihoodSchema,
  severity: SeveritySchema,
  risk_score: z.number().min(1).max(9),
});

export const AdversarialOutputSchema = z.object({
  matched_failure_modes: z.array(MatchedFailureModeSchema),
  sequence_failures: z.array(MatchedFailureModeSchema),
  must_resolve: z.array(z.string()), // failure mode IDs
  should_resolve: z.array(z.string()),
});

export type AdversarialOutput = z.infer<typeof AdversarialOutputSchema>;

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

// ── Pass 5: Invariants ───────────────────────────────────────────────────────

export const InvariantSchema = z.object({
  id: z.string(),
  statement: z.string(),
  formal_assertion: z.string(), // TLA+ expression
  category: z.enum(["safety", "liveness", "fairness"]),
  source: z.string(),           // e.g., "FM-001" or "FR-003"
});

export const ModelGroupSchema = z.object({
  model_id: z.string(),         // e.g., "BalanceSafety"
  variables: z.array(z.string()),
  symmetry: z.string().optional(),
  bounds: z.record(z.string(), z.number()),
  invariants: z.array(InvariantSchema).min(1),
});

export const Pass5InputSchema = z.object({
  model_groups: z.array(ModelGroupSchema).min(1),
});

export type Pass5Input = z.infer<typeof Pass5InputSchema>;
```
