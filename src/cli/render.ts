export type CatalogView = {
  modules: Array<{
    name: string;
    functions: Array<{
      name: string;
      params: Array<{ name: string; type: string | null; optional: boolean }>;
      returns: string;
    }>;
    types: Array<{ name: string; raw: string }>;
    hardDeps: string[];
    softDeps: string[];
    coreInherits: string[];
  }>;
  core: Array<{ name: string; implicit: boolean }>;
};

export function renderList(catalog: CatalogView): string {
  const lines: string[] = [];

  lines.push("Modules:");
  for (const mod of catalog.modules.sort((a, b) => a.name.localeCompare(b.name))) {
    const deps = mod.hardDeps.length > 0 ? mod.hardDeps.join(", ") : "(none)";
    const soft = mod.softDeps.length > 0 ? mod.softDeps.join(", ") : "(none)";
    const coreInherits = mod.coreInherits.length > 0 ? mod.coreInherits.join(", ") : "(none)";
    const summary = mod.functions.length > 0 ? ` (${mod.functions.length} functions)` : "";
    lines.push(`  ${mod.name}${summary}`);
    lines.push(`    deps: ${deps}`);
    lines.push(`    recommends: ${soft}`);
    lines.push(`    inherits: ${coreInherits}`);
  }

  lines.push("");
  lines.push("Core contracts:");
  for (const c of catalog.core.sort((a, b) => a.name.localeCompare(b.name))) {
    lines.push(`  ${c.name}${c.implicit ? " (implicit)" : ""}`);
  }

  return lines.join("\n");
}

export function renderAdapterList(byModule: Record<string, string[]>, filter?: string): string {
  const lines: string[] = [];
  const modules = Object.keys(byModule).sort();

  lines.push("Available adapters:");
  lines.push("");

  for (const module of modules) {
    if (filter && !module.includes(filter)) {
      continue;
    }
    const adapters = byModule[module]!;
    lines.push(`  ${module}`);
    for (const adapter of adapters) {
      lines.push(`    - ${adapter}`);
    }
  }

  return lines.join("\n");
}

export function minimalCatalog(catalog: CatalogView) {
  return {
    modules: catalog.modules.map((mod) => ({
      name: mod.name,
      functions: mod.functions.map((fn) => ({
        name: fn.name,
        params: fn.params.map((p) => `${p.name}${p.optional ? "?" : ""}: ${p.type ?? "unknown"}`),
        returns: fn.returns,
      })),
      hardDeps: mod.hardDeps,
      softDeps: mod.softDeps,
      coreInherits: mod.coreInherits,
    })),
    core: catalog.core.map((c) => ({
      name: c.name,
      implicit: c.implicit,
    })),
  };
}

export function generateJsonSchema(catalog: CatalogView) {
  return {
    "$schema": "http://json-schema.org/draft-07/schema#",
    title: "Engineering Blueprinter Catalog",
    type: "object",
    properties: {
      modules: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            functions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  params: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        type: { type: ["string", "null"] },
                        optional: { type: "boolean" },
                      },
                    },
                  },
                  returns: { type: "string" },
                },
              },
            },
            hardDeps: { type: "array", items: { type: "string" } },
            softDeps: { type: "array", items: { type: "string" } },
            coreInherits: { type: "array", items: { type: "string" } },
          },
        },
      },
      core: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            implicit: { type: "boolean" },
          },
        },
      },
    },
  };
}
