import * as fs from "fs/promises";
import * as path from "path";
import { KnowledgeGraph } from "./graph";
import { FailureMode, KnowledgeNode, ImplicitConstraint } from "./types";

/**
 * Parses KNOWLEDGE_BASE.md into a KnowledgeGraph instance.
 * Uses simple regex-based parsing for the established markdown structure.
 */
export async function loadKnowledgeBase(filePath: string): Promise<KnowledgeGraph> {
  const content = await fs.readFile(filePath, "utf8");
  const graph = new KnowledgeGraph();

  // 1. Parse Failure Modes (Part 1)
  const fmSection = content.split("## Part 1")[1]?.split("## Part 2")[0];
  if (fmSection) {
    const fmBlocks = fmSection.split("### ").slice(1);
    for (const block of fmBlocks) {
      const idMatch = block.match(/(FM-\d+)/);
      const nameMatch = block.match(/— (.*)/);
      const severityMatch = block.match(/\((CRITICAL|HIGH|MEDIUM|LOW)\)/);
      const descriptionMatch = block.match(/\*\*Description\*\*: (.*)/);
      const invariantMatch = block.match(/\*\*Formal invariant\*\*: \s*`?ASSERT: (.*)`?/);
      const mitigationMatch = block.match(/\*\*Required mitigation\*\*: .* \(see Node: (.*)\)/);

      if (idMatch && nameMatch && severityMatch) {
        const fm: FailureMode = {
          id: idMatch[1],
          name: nameMatch[1].trim(),
          severity: severityMatch[1] as any,
          description: descriptionMatch ? descriptionMatch[1].trim() : "",
          formalInvariant: invariantMatch ? invariantMatch[1].trim() : "",
          requiredMitigation: mitigationMatch ? mitigationMatch[1].trim() : "",
        };
        graph.addFailureMode(fm);
      }
    }
  }

  // 2. Parse Engineering Primitives (Part 2)
  const nodeSection = content.split("## Part 2")[1]?.split("## Part 3")[0];
  if (nodeSection) {
    const nodeBlocks = nodeSection.split("### Node: ").slice(1);
    for (const block of nodeBlocks) {
      const lines = block.split("\n");
      const id = lines[0].trim();
      const categoryMatch = block.match(/\*\*Category\*\*: (.*)/);
      const descriptionMatch = block.match(/\*\*Definition\*\*: (.*)/);
      
      const solvesMatch = block.match(/\*\*SOLVES\*\*: (.*)/);
      const requiresMatch = block.match(/\*\*REQUIRES\*\*: (.*)/);
      const introducesMatch = block.match(/\*\*INTRODUCES\*\*: (.*)/);
      const conflictsMatch = block.match(/\*\*CONFLICTS_WITH\*\*: (.*)/);

      const parseIds = (match: RegExpMatchArray | null) => 
        match ? match[1].split(",").map(s => s.trim().split(" ")[0].replace(/[\(\)]/g, "")) : [];

      const node: KnowledgeNode = {
        id,
        category: categoryMatch ? categoryMatch[1].trim() : "",
        description: descriptionMatch ? descriptionMatch[1].trim() : "",
        solves: parseIds(solvesMatch),
        requires: parseIds(requiresMatch),
        introduces: parseIds(introducesMatch),
        conflictsWith: parseIds(conflictsMatch),
      };
      graph.addNode(node);
    }
  }

  // 3. Parse Implicit Constraints (Part 4)
  const constraintSection = content.split("## Part 4")[1];
  if (constraintSection) {
    const constraints: ImplicitConstraint[] = [];
    const lines = constraintSection.split("\n");
    let currentId = 1;
    for (const line of lines) {
      const match = line.match(/^\d+\.\s+\*\*(.*)\*\*\s+(.*)/);
      if (match) {
        constraints.push({
          id: `IC-${String(currentId++).padStart(3, "0")}`,
          statement: `${match[1]} ${match[2]}`.trim(),
        });
      } else if (line.trim().startsWith("- ")) {
         // Fallback for simple bullets
         constraints.push({
          id: `IC-${String(currentId++).padStart(3, "0")}`,
          statement: line.replace("- ", "").trim(),
        });
      }
    }
    graph.setImplicitConstraints(constraints);
  }

  const errors = graph.validate();
  if (errors.length > 0) {
    throw new Error(`Knowledge Base validation failed:\n- ${errors.join("\n- ")}`);
  }

  return graph;
}
