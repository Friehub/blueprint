import type { Catalog } from "../catalog.js";
import type { AdapterDefinition, AdapterIssue, AdapterResolution, UserSelection } from "./types.js";
import { validateAdapter } from "./validate.js";

export function resolveAdapters(
  selection: UserSelection,
  adapters: AdapterDefinition[],
  catalog: Catalog,
): AdapterResolution {
  const selected: Record<string, string> = {};
  const fallbacks: Record<string, string> = {};
  const issues: AdapterIssue[] = [];

  for (const [module, adapterRef] of Object.entries(selection.adapters)) {
    if (typeof adapterRef === "string") {
      selected[module] = adapterRef;
    } else {
      selected[module] = adapterRef.primary;
      if (adapterRef.fallback) {
        fallbacks[module] = adapterRef.fallback;
      }
    }
  }

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

  for (const [module, provider] of Object.entries(fallbacks)) {
    const adapter = adapters.find((a) => a.module === module && a.name === provider);
    if (!adapter) {
      issues.push({
        adapter: provider,
        module,
        message: `Fallback adapter "${provider}" not found for module "${module}"`,
        severity: "warning",
      });
    }
  }

  for (const module of catalog.modules) {
    if (!selected[module.name] && module.hardDeps.length > 0) {
      const hasAdapterSelection = Object.keys(selected).some(
        (m) => module.hardDeps.includes(m) || m === module.name,
      );
      if (hasAdapterSelection) {
        issues.push({
          adapter: "",
          module: module.name,
          message: `Module "${module.name}" is required but has no adapter selected`,
          severity: "warning",
        });
      }
    }
  }

  return { selected, fallbacks, issues };
}

export function listAdaptersByModule(adapters: AdapterDefinition[]): Record<string, string[]> {
  const byModule: Record<string, string[]> = {};

  for (const adapter of adapters) {
    const list = byModule[adapter.module];
    if (list) {
      list.push(adapter.name);
    } else {
      byModule[adapter.module] = [adapter.name];
    }
  }

  for (const module of Object.keys(byModule)) {
    const list = byModule[module];
    if (list) {
      list.sort();
    }
  }

  return byModule;
}

export function findAdapter(
  adapters: AdapterDefinition[],
  module: string,
  provider: string,
): AdapterDefinition | null {
  return adapters.find((a) => a.module === module && a.name === provider) ?? null;
}
