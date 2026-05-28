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
      issues.push({
        adapter: adapter.name,
        module: adapter.module,
        message: `Adapter implements "${fn}" but contract does not define it`,
        severity: "warning",
      });
    }
  }

  for (const fn of module.functions) {
    if (!adapter.implements.includes(fn.name)) {
      if (adapter.does_not_implement?.includes(fn.name)) {
        continue;
      }
      issues.push({
        adapter: adapter.name,
        module: adapter.module,
        message: `Contract defines "${fn.name}" but adapter does not implement it`,
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

export function validateAdapterSelection(
  selected: Record<string, string>,
  adapters: AdapterDefinition[],
  catalog: Catalog,
): ValidationResult {
  const issues: AdapterIssue[] = [];

  for (const [module, provider] of Object.entries(selected)) {
    const adapter = adapters.find((a) => a.module === module && a.name === provider);
    if (!adapter) {
      issues.push({
        adapter: provider,
        module,
        message: `Adapter "${provider}" not found for module "${module}"`,
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
