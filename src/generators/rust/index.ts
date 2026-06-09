import type { ModuleContract, ContractFunction } from "../../core/catalog.js";
import type { AdapterDefinition } from "../../core/adapters/types.js";
import { adapterSupportsLanguage } from "../../core/adapters/types.js";
import type { Language, GeneratorContext, GeneratorResult, GeneratedFile, LanguageGenerator } from "../types.js";
import { pascalCase, snakeCase, mapType } from "../types.js";
import {
  generateTypeDefinition,
  generateFunctionSignature,
  generateParamsList,
  generateErrorEnum,
  generateSharedTypes,
} from "./helpers.js";

export class RustGenerator implements LanguageGenerator {
  language: Language = "rust";
  name = "Rust Generator";
  protected context: GeneratorContext | null = null;

  generateInterfaces(context: GeneratorContext): GeneratorResult {
    this.context = context;
    const files: GeneratedFile[] = [];
    const errors: string[] = [];
    let modules = this.resolveModules(context);

    files.push({ path: "interfaces/shared.rs", content: generateSharedTypes() });

    for (const mod of modules) {
      try {
        files.push({ path: `interfaces/${mod.name}.rs`, content: this.generateModuleInterface(mod) });
      } catch (error) {
        errors.push(`Failed to generate interface for ${mod.name}: ${error instanceof Error ? error.message : error}`);
      }
    }
    return { files, errors };
  }

  generateAdapter(context: GeneratorContext): GeneratorResult {
    this.context = context;
    const files: GeneratedFile[] = [];
    const errors: string[] = [];
    const adapters = context.adapters.filter((a) => {
      if (context.module && a.module !== context.module) return false;
      if (context.provider && a.name !== context.provider) return false;
      if (!adapterSupportsLanguage(a, this.language)) return false;
      return true;
    });

    for (const adapter of adapters) {
      try {
        const mod = context.catalog.modules.find((m) => m.name === adapter.module);
        if (!mod) { errors.push(`Module ${adapter.module} not found for adapter ${adapter.name}`); continue; }
        files.push({ path: `adapters/${adapter.module}/${adapter.name}.rs`, content: this.generateAdapterClass(adapter, mod) });
      } catch (error) {
        errors.push(`Failed to generate adapter ${adapter.name}: ${error instanceof Error ? error.message : error}`);
      }
    }
    return { files, errors };
  }

  generateTests(context: GeneratorContext): GeneratorResult {
    const files: GeneratedFile[] = [];
    const errors: string[] = [];
    const adapters = context.adapters.filter((a) => {
      if (context.module && a.module !== context.module) return false;
      if (context.provider && a.name !== context.provider) return false;
      if (!adapterSupportsLanguage(a, this.language)) return false;
      return true;
    });

    for (const adapter of adapters) {
      try {
        const mod = context.catalog.modules.find((m) => m.name === adapter.module);
        if (!mod) { errors.push(`Module ${adapter.module} not found for adapter ${adapter.name}`); continue; }
        files.push({ path: `__tests__/${adapter.module}/${adapter.name}_test.rs`, content: this.generateConformanceTest(adapter, mod) });
      } catch (error) {
        errors.push(`Failed to generate test for ${adapter.name}: ${error instanceof Error ? error.message : error}`);
      }
    }
    return { files, errors };
  }

  private resolveModules(context: GeneratorContext): ModuleContract[] {
    let modules = context.module
      ? context.catalog.modules.filter((m) => m.name === context.module)
      : context.catalog.modules;

    if (context.module) {
      const targetMod = context.catalog.modules.find((m) => m.name === context.module);
      if (targetMod) {
        for (const dep of targetMod.hardDeps) {
          const depMod = context.catalog.modules.find((m) => m.name === dep);
          if (depMod && !modules.some((m) => m.name === dep)) modules = [...modules, depMod];
        }
      }
    }
    return modules;
  }

  private generateModuleInterface(mod: ModuleContract): string {
    const versionNote = mod.version ? `v${mod.version}` : "version not specified";
    const ns = this.context?.namespace ? `${pascalCase(this.context.namespace)}_` : "";
    const lines: string[] = [
      `// ${mod.name}.rs — ${versionNote} — contracts/${mod.name}.md`,
      `// Auto-generated from contracts/${mod.name}.md -- namespace: "${this.context?.namespace ?? "none"}"`,
      `// Types are inferred from naming conventions. Review before production use.`,
      "",
      "use async_trait::async_trait;",
      "use serde::{Deserialize, Serialize};",
      "",
    ];
    for (const type of mod.types) {
      const defn = generateTypeDefinition(type);
      lines.push(defn);
      lines.push("");
    }
    const traitName = `${ns}${pascalCase(mod.name)}Contract`;
    lines.push(`#[async_trait]`);
    lines.push(`pub trait ${traitName} {`);
    for (const fn of mod.functions) lines.push(generateFunctionSignature(fn));
    lines.push("}");
    lines.push("");
    lines.push(generateErrorEnum(mod.name));
    return lines.join("\n");
  }

  private generateAdapterClass(adapter: AdapterDefinition, mod: ModuleContract): string {
    const ns = this.context?.namespace ? `${pascalCase(this.context.namespace)}_` : "";
    const interfaceName = `${ns}${pascalCase(mod.name)}Contract`;
    const adapterPascal = pascalCase(adapter.name);
    const lines: string[] = [
      `// ${adapter.name}.rs`,
      `// Auto-generated adapter for ${adapter.name} → ${mod.name} -- namespace: "${this.context?.namespace ?? "none"}"`,
      "",
      "use async_trait::async_trait;",
      `use super::interfaces::{${interfaceName}, ${ns}${pascalCase(mod.name)}Error};`,
      "",
    ];

    const structName = `${ns}${adapterPascal}Adapter`;
    const configFields = adapter.config.required.map((f) => {
      const goType = mapType(f.type, "rust");
      return `    pub ${snakeCase(f.name)}: ${goType},`;
    }).join("\n");
    lines.push(`pub struct ${structName} {`);
    if (configFields) lines.push(configFields);
    lines.push("}");
    lines.push("");

    const configArgs = adapter.config.required.map((f) => `${snakeCase(f.name)}: ${mapType(f.type, "rust")}`).join(", ");
    lines.push(`impl ${structName} {`);
    lines.push(`    pub fn new(${configArgs}) -> Self {`);
    lines.push(`        Self {`);
    for (const f of adapter.config.required) {
      lines.push(`            ${snakeCase(f.name)},`);
    }
    lines.push("        }");
    lines.push("    }");
    lines.push("}");
    lines.push("");

    lines.push(`#[async_trait]`);
    lines.push(`impl ${interfaceName} for ${structName} {`);
    for (const fn of mod.functions) {
      if (adapter.implements.includes(fn.name)) {
        lines.push(this.generateAdapterMethod(fn, structName));
      } else {
        const msg = adapter.does_not_implement?.includes(fn.name)
          ? `Not supported by ${adapter.name}: ${fn.name}`
          : `Not yet implemented: ${fn.name}`;
        lines.push(this.generateUnimplementedMethod(fn, msg));
      }
    }
    lines.push("}");
    return lines.join("\n");
  }

  private generateAdapterMethod(fn: ContractFunction, structName: string): string {
    const returnType = mapType(fn.returns, "rust");
    const params = generateParamsList(fn);
    return `    async fn ${snakeCase(fn.name)}(&self, ${params}) -> Result<${returnType}, ${structName}Error> {\n        todo!("Implement ${fn.name}")\n    }\n`;
  }

  private generateUnimplementedMethod(fn: ContractFunction, message: string): string {
    const returnType = mapType(fn.returns, "rust");
    const params = generateParamsList(fn);
    return `    async fn ${snakeCase(fn.name)}(&self, ${params}) -> Result<${returnType}, Box<dyn std::error::Error>> {\n        unimplemented!("${message}")\n    }\n`;
  }

  private generateConformanceTest(adapter: AdapterDefinition, mod: ModuleContract): string {
    const adapterPascal = pascalCase(adapter.name);
    const structName = `${adapterPascal}Adapter`;
    const lines: string[] = [
      `// ${adapter.name}_test.rs`,
      `// Auto-generated conformance test for ${adapter.name} → ${mod.name}`,
      "",
      "#[cfg(test)]",
      "mod tests {",
      `    use super::*;`,
      "",
      `    #[test]`,
      `    fn test_${snakeCase(adapter.name)}_adapter_creation() {`,
    ];

    const testConfigArgs = adapter.config.required.map((f) => `"test".to_string()`).join(", ");
    lines.push(`        let adapter = ${structName}::new(${testConfigArgs});`);
    lines.push("    }");
    lines.push("}");
    return lines.join("\n");
  }
}
