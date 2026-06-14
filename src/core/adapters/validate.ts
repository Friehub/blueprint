import type { Catalog, ModuleContract } from "../catalog.js";
import type { AdapterDefinition, AdapterIssue } from "./types.js";

export type ValidationResult = {
  valid: boolean;
  issues: AdapterIssue[];
};

export function validateAdapter(
  adapter: AdapterDefinition,
  catalog: Catalog,
): ValidationResult {
  const issues: AdapterIssue[] = [];

  const module = catalog.modules.find((m) => m.name === adapter.module);
  if (!module) {
    issues.push({
      adapter: adapter.name,
      module: adapter.module,
      message: `Module "${adapter.module}" not found in catalog`,
      severity: "error",
    });
    return { valid: false, issues };
  }

  for (const fn of adapter.implements) {
    const contractFn = module.functions.find((f) => f.name === fn);
    if (!contractFn) {
      const similar = findSimilarFunction(fn, module);
      const suggestion = similar ? ` Did you mean "${similar}"?` : "";
      issues.push({
        adapter: adapter.name,
        module: adapter.module,
        message: `Adapter implements "${fn}" but contract does not define it.${suggestion}`,
        severity: "warning",
      });
    }
  }

  for (const fn of module.functions) {
    if (!adapter.implements.includes(fn.name)) {
      if (adapter.does_not_implement?.includes(fn.name)) {
        continue;
      }
      const similar = findSimilarFunction(fn.name, adapter);
      const suggestion = similar ? ` Did you mean "${similar}"?` : "";
      const params = fn.params.map((p) => `${p.name}${p.optional ? "?" : ""}: ${p.type ?? "unknown"}`).join(", ");
      issues.push({
        adapter: adapter.name,
        module: adapter.module,
        message: `Contract defines "${fn.name}(${params})" but adapter does not implement it.${suggestion}`,
        severity: "error",
      });
    }
  }

  for (const dep of adapter.dependencies ?? []) {
    const depModule = catalog.modules.find((m) => m.name === dep.module);
    if (!depModule) {
      issues.push({
        adapter: adapter.name,
        module: adapter.module,
        message: `Adapter depends on "${dep.module}" but it is not in the catalog`,
        severity: "warning",
      });
    }
  }

  return {
    valid: issues.filter((i) => i.severity === "error").length === 0,
    issues,
  };
}

function findSimilarFunction(target: string, source: { functions?: Array<{ name: string }> } | { implements?: string[] }): string | null {
  let names: string[] = [];
  if ("functions" in source && source.functions) {
    names = source.functions.map((f) => f.name);
  } else if ("implements" in source && source.implements) {
    names = source.implements;
  }
  const targetLower = target.toLowerCase();

  for (const name of names) {
    if (name.toLowerCase() === targetLower) continue;
    if (name.toLowerCase().includes(targetLower) || targetLower.includes(name.toLowerCase())) {
      return name;
    }
    if (levenshteinDistance(name.toLowerCase(), targetLower) <= 3) {
      return name;
    }
  }

  return null;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]!;
      } else {
        dp[i]![j] = 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
      }
    }
  }

  return dp[m]![n]!;
}

export function validateAdapterSelection(
  selected: Record<string, string>,
  adapters: AdapterDefinition[],
  catalog: Catalog,
): ValidationResult {
  const issues: AdapterIssue[] = [];

  for (const [module, provider] of Object.entries(selected)) {
    const adapter = adapters.find((a) => a.module === module && a.name === provider);
    if (!adapter) {
      const available = adapters.filter((a) => a.module === module).map((a) => a.name);
      const suggestion = available.length > 0 ? ` Available adapters: ${available.join(", ")}` : "";
      issues.push({
        adapter: provider,
        module,
        message: `Adapter "${provider}" not found for module "${module}".${suggestion}`,
        severity: "error",
      });
      continue;
    }

    const result = validateAdapter(adapter, catalog);
    issues.push(...result.issues);
  }

  return {
    valid: issues.filter((i) => i.severity === "error").length === 0,
    issues,
  };
}
