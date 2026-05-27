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
