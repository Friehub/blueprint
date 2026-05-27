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
