import type { Catalog, ModuleContract, ContractFunction } from "./catalog.js";
import type { AdapterDefinition } from "./adapters/types.js";
import { pascalCase, camelCase } from "../generators/types.js";

export type ImplementPrompt = {
  module: string;
  adapter: string;
  function: string;
  prompt: string;
};

export function generateImplementPrompts(
  catalog: Catalog,
  adapters: AdapterDefinition[],
  moduleName: string,
  adapterName: string,
): ImplementPrompt[] {
  const mod = catalog.modules.find((m) => m.name === moduleName);
  if (!mod) return [];

  const adapter = adapters.find((a) => a.name === adapterName && a.module === moduleName);
  if (!adapter) return [];

  const prompts: ImplementPrompt[] = [];

  for (const fn of mod.functions) {
    if (!adapter.implements.includes(fn.name)) continue;
    if (adapter.does_not_implement?.includes(fn.name)) continue;

    prompts.push({
      module: moduleName,
      adapter: adapterName,
      function: fn.name,
      prompt: buildPrompt(fn, adapter, mod),
    });
  }

  return prompts;
}

function buildPrompt(fn: ContractFunction, adapter: AdapterDefinition, mod: ModuleContract): string {
  const params = fn.params.map((p) => {
    const typeStr = p.type ? `: ${p.type}` : "";
    return `${p.name}${p.optional ? "?" : ""}${typeStr}`;
  }).join(", ");

  const signature = `${camelCase(fn.name)}(${params}) → ${fn.returns}`;
  const config = adapter.config.required.map((f) => `${f.name}: ${f.type}`).join(", ");

  let prompt = `// Implement: ${mod.name}.${fn.name}
// Contract: contracts/${mod.name}.md v${mod.version ?? "0.1.0"}
// Adapter: ${adapter.name} → ${mod.name}
// Signature: ${signature}

Instructions:
1. Implement ${camelCase(fn.name)} using the ${adapter.name} SDK
2. The adapter is configured with: { ${config} }
3. Follow the contract rules in contracts/${mod.name}.md
4. Returns must match the contract type exactly`;

  if (fn.returns !== "void") {
    prompt += `\n5. Return type: ${fn.returns}`;
  }

  if (fn.params.length > 0) {
    prompt += `\n6. Parameters: ${fn.params.map((p) => p.name).join(", ")}`;
  }

  return prompt;
}
