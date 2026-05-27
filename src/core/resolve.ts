import type { Catalog, CoreContract, ModuleContract, ResolvedModule, ResolvedSet } from "./catalog.js";
import { implicitCores } from "./catalog.js";

type ResolveEntry = {
  name: string;
  source: "explicit" | "hard-dep" | "soft-dep";
};

export function detectCycles(catalog: Catalog): string[][] {
  const moduleByName = new Map<string, ModuleContract>();
  for (const mod of catalog.modules) {
    moduleByName.set(mod.name, mod);
  }

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const path: string[] = [];

  function dfs(name: string) {
    if (inStack.has(name)) {
      const cycleStart = path.indexOf(name);
      cycles.push(path.slice(cycleStart).concat(name));
      return;
    }
    if (visited.has(name)) return;

    visited.add(name);
    inStack.add(name);
    path.push(name);

    const mod = moduleByName.get(name);
    if (mod) {
      for (const dep of mod.hardDeps) {
        if (moduleByName.has(dep)) {
          dfs(dep);
        }
      }
    }

    path.pop();
    inStack.delete(name);
  }

  for (const mod of catalog.modules) {
    dfs(mod.name);
  }

  return cycles;
}

export function resolve(catalog: Catalog, requestedModules: string[]): ResolvedSet {
  const moduleByName = new Map<string, ModuleContract>();
  for (const mod of catalog.modules) {
    moduleByName.set(mod.name, mod);
  }

  const resolved = new Map<string, ResolveEntry>();
  const warnings: string[] = [];

  for (const name of requestedModules) {
    if (!moduleByName.has(name)) {
      warnings.push(`Module not found in catalog: ${name}`);
      continue;
    }
    resolved.set(name, { name, source: "explicit" });
  }

  const queue: Array<{ name: string; via: "explicit" | "hard-dep" }> = requestedModules.map((name) => ({
    name,
    via: "explicit",
  }));

  const inQueue = new Set(requestedModules);

  while (queue.length > 0) {
    const current = queue.shift()!;
    inQueue.delete(current.name);
    const mod = moduleByName.get(current.name);
    if (!mod) continue;

    for (const dep of mod.hardDeps) {
      if (resolved.has(dep)) continue;
      if (!moduleByName.has(dep)) {
        warnings.push(`Hard dependency not found in catalog: ${dep} (required by ${current.name})`);
        continue;
      }
      resolved.set(dep, { name: dep, source: "hard-dep" });
      if (!inQueue.has(dep)) {
        queue.push({ name: dep, via: "hard-dep" });
        inQueue.add(dep);
      }
    }

    if (current.via === "explicit") {
      for (const dep of mod.softDeps) {
        if (resolved.has(dep)) continue;
        if (!moduleByName.has(dep)) continue;
        resolved.set(dep, { name: dep, source: "soft-dep" });
      }
    }
  }

  const resolvedModules: ResolvedModule[] = [...resolved.values()].map((entry) => {
    const mod = moduleByName.get(entry.name)!;
    return {
      name: entry.name,
      source: entry.source,
      hardDeps: mod.hardDeps,
      softDeps: mod.softDeps,
    };
  });

  resolvedModules.sort((a, b) => {
    const order = { explicit: 0, "hard-dep": 1, "soft-dep": 2 } as const;
    return (order[a.source] ?? 3) - (order[b.source] ?? 3) || a.name.localeCompare(b.name);
  });

  const implicitCore = implicitCores(catalog);
  const coreByName = new Map<string, CoreContract>();
  for (const c of implicitCore) {
    coreByName.set(c.name, c);
  }

  for (const entry of resolved.values()) {
    const mod = moduleByName.get(entry.name);
    if (!mod) continue;
    for (const coreName of mod.coreInherits) {
      if (coreByName.has(coreName)) continue;
      const coreContract = catalog.core.find((c) => c.name === coreName);
      if (coreContract) {
        coreByName.set(coreName, coreContract);
      }
    }
  }

  const core = [...coreByName.values()];

  return { modules: resolvedModules, core, warnings };
}
