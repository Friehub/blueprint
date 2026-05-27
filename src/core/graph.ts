import type { Catalog, ModuleContract } from "./catalog.js";

type GraphNode = {
  name: string;
  kind: "module" | "core";
  source: "explicit" | "hard-dep" | "soft-dep" | "inherited";
};

type GraphEdge = {
  from: string;
  to: string;
  kind: "hard" | "soft" | "inherit";
};

export type GraphResult = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export function buildGraph(catalog: Catalog, moduleName: string): GraphResult {
  const moduleByName = new Map<string, ModuleContract>();
  for (const mod of catalog.modules) {
    moduleByName.set(mod.name, mod);
  }

  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  const mod = moduleByName.get(moduleName);
  if (!mod) {
    return { nodes: [], edges: [] };
  }

  nodes.set(moduleName, { name: moduleName, kind: "module", source: "explicit" });

  for (const dep of mod.hardDeps) {
    if (!nodes.has(dep)) {
      nodes.set(dep, { name: dep, kind: "module", source: "hard-dep" });
    }
    edges.push({ from: moduleName, to: dep, kind: "hard" });
  }

  for (const dep of mod.softDeps) {
    if (!nodes.has(dep)) {
      nodes.set(dep, { name: dep, kind: "module", source: "soft-dep" });
    }
    edges.push({ from: moduleName, to: dep, kind: "soft" });
  }

  for (const coreName of mod.coreInherits) {
    if (!nodes.has(coreName)) {
      nodes.set(coreName, { name: coreName, kind: "core", source: "inherited" });
    }
    edges.push({ from: moduleName, to: coreName, kind: "inherit" });
  }

  for (const dep of mod.hardDeps) {
    const depMod = moduleByName.get(dep);
    if (!depMod) continue;

    for (const transitive of depMod.hardDeps) {
      if (!nodes.has(transitive)) {
        nodes.set(transitive, { name: transitive, kind: "module", source: "hard-dep" });
      }
      edges.push({ from: dep, to: transitive, kind: "hard" });
    }

    for (const coreName of depMod.coreInherits) {
      if (!nodes.has(coreName)) {
        nodes.set(coreName, { name: coreName, kind: "core", source: "inherited" });
      }
      edges.push({ from: dep, to: coreName, kind: "inherit" });
    }
  }

  return {
    nodes: [...nodes.values()],
    edges,
  };
}

export function renderAscii(graph: GraphResult, rootName: string): string {
  const lines: string[] = [];
  const nodeMap = new Map(graph.nodes.map((n) => [n.name, n]));

  lines.push(`Dependency graph for: ${rootName}`);
  lines.push("");

  const hardChildren = graph.edges
    .filter((e) => e.from === rootName && e.kind === "hard")
    .map((e) => e.to);
  const softChildren = graph.edges
    .filter((e) => e.from === rootName && e.kind === "soft")
    .map((e) => e.to);
  const inheritChildren = graph.edges
    .filter((e) => e.from === rootName && e.kind === "inherit")
    .map((e) => e.to);

  const allChildren: Array<{ name: string; kind: "hard" | "soft" | "inherit" }> = [];
  for (const c of hardChildren) allChildren.push({ name: c, kind: "hard" });
  for (const c of softChildren) allChildren.push({ name: c, kind: "soft" });
  for (const c of inheritChildren) allChildren.push({ name: c, kind: "inherit" });

  const seen = new Set<string>();
  const uniqueChildren = allChildren.filter((c) => {
    if (seen.has(c.name)) return false;
    seen.add(c.name);
    return true;
  });

  lines.push(`${rootName} *`);

  for (let i = 0; i < uniqueChildren.length; i++) {
    const child = uniqueChildren[i]!;
    const isLast = i === uniqueChildren.length - 1;
    const prefix = isLast ? "└── " : "├── ";
    const label = child.kind === "hard" ? " (hard)" : child.kind === "soft" ? " (soft)" : " [core]";
    lines.push(`${prefix}${child.name}${label}`);
  }

  lines.push("");
  lines.push("* = explicitly requested");

  return lines.join("\n");
}

export function renderMermaid(graph: GraphResult, rootName: string): string {
  const lines: string[] = [];

  lines.push("graph TD");

  for (const node of graph.nodes) {
    const id = node.name.replace(/[^a-zA-Z0-9]/g, "_");
    if (node.kind === "core") {
      lines.push(`  ${id}["${node.name}\\n[core]"]`);
    } else if (node.source === "explicit") {
      lines.push(`  ${id}["${node.name}"]`);
    } else {
      lines.push(`  ${id}("${node.name}")`);
    }
  }

  lines.push("");

  for (const edge of graph.edges) {
    const fromId = edge.from.replace(/[^a-zA-Z0-9]/g, "_");
    const toId = edge.to.replace(/[^a-zA-Z0-9]/g, "_");

    if (edge.kind === "hard") {
      lines.push(`  ${fromId} -->|hard| ${toId}`);
    } else if (edge.kind === "soft") {
      lines.push(`  ${fromId} -.->|soft| ${toId}`);
    } else {
      lines.push(`  ${fromId} -.->|inherits| ${toId}`);
    }
  }

  return lines.join("\n");
}
