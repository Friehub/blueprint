import type { ModuleContract, ContractFunction } from "../../core/catalog.js";
import type { AdapterDefinition } from "../../core/adapters/types.js";
import { adapterSupportsLanguage } from "../../core/adapters/types.js";
import type { Language, GeneratorContext, GeneratorResult, GeneratedFile, LanguageGenerator } from "../types.js";
import { resolveAlias, resolveModuleAlias, resolveClassAlias, resolveConfigAlias, obfuscateName } from "../aliases.js";
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

  private nsPath(base: string): string {
    return this.context?.namespace ? `${pascalCase(this.context.namespace)}/${base}` : base;
  }

  private resolveFnName(name: string): string {
    if (this.context?.obfuscate) return obfuscateName(this.context.obfuscate, name);
    return resolveAlias(name, this.context?.aliases);
  }

  private resolveModName(name: string): string {
    if (this.context?.obfuscate) return obfuscateName(this.context.obfuscate, name);
    return resolveModuleAlias(name, this.context?.aliases);
  }

  private resolveClsName(name: string, provider: string): string {
    if (this.context?.obfuscate) return obfuscateName(this.context.obfuscate, provider + "_" + name);
    const defaultName = `${pascalCase(provider)}Adapter`;
    return resolveClassAlias(defaultName, this.context?.aliases);
  }

  private resolveCfgName(name: string): string {
    if (this.context?.obfuscate) return obfuscateName(this.context.obfuscate, name);
    return resolveConfigAlias(name, this.context?.aliases);
  }

  generateInterfaces(context: GeneratorContext): GeneratorResult {
    this.context = context;
    const files: GeneratedFile[] = [];
    const errors: string[] = [];
    let modules = this.resolveModules(context);

    files.push({ path: this.nsPath("interfaces/shared.rs"), content: generateSharedTypes() });

    for (const mod of modules) {
      try {
        files.push({ path: this.nsPath(`interfaces/${this.resolveModName(mod.name)}.rs`), content: this.generateModuleInterface(mod) });
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
        files.push({ path: this.nsPath(`adapters/${this.resolveModName(adapter.module)}/${adapter.name}.rs`), content: this.generateAdapterClass(adapter, mod) });
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
        files.push({ path: this.nsPath(`__tests__/${this.resolveModName(adapter.module)}/${adapter.name}_test.rs`), content: this.generateConformanceTest(adapter, mod) });
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
    const ns = this.context?.namespace ? `${pascalCase(this.context.namespace)}_` : "";
    const lines: string[] = [
      `// ${mod.name}.rs`,
      `// Do not edit directly. Generated code.`,
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
    const traitName = `${ns}${pascalCase(this.resolveModName(mod.name))}Contract`;
    lines.push(`#[async_trait]`);
    lines.push(`pub trait ${traitName} {`);
    for (const fn of mod.functions) {
      const aliasedFn = { ...fn, name: this.resolveFnName(fn.name) };
      lines.push(generateFunctionSignature(aliasedFn));
    }
    lines.push("}");
    lines.push("");
    lines.push(generateErrorEnum(mod.name));
    return lines.join("\n");
  }

  private generateAdapterClass(adapter: AdapterDefinition, mod: ModuleContract): string {
    const ns = this.context?.namespace ? `${pascalCase(this.context.namespace)}_` : "";
    const interfaceName = `${ns}${pascalCase(this.resolveModName(mod.name))}Contract`;
    const adapterPascal = pascalCase(adapter.name);
    const lines: string[] = [
      `// ${adapter.name}.rs`,
      `// Do not edit directly. Generated code.`,
      "",
      "use async_trait::async_trait;",
      `use super::interfaces::{${interfaceName}, ${ns}${pascalCase(this.resolveModName(mod.name))}Error};`,
      "",
    ];

    const structName = `${ns}${this.resolveClsName(adapter.name, adapter.name)}`;
    const configFields = adapter.config.required.map((f) => {
      const goType = mapType(f.type, "rust");
      return `    pub ${snakeCase(this.resolveCfgName(f.name))}: ${goType},`;
    }).join("\n");
    lines.push(`pub struct ${structName} {`);
    if (configFields) lines.push(configFields);
    lines.push("}");
    lines.push("");

    const configArgs = adapter.config.required.map((f) => `${snakeCase(this.resolveCfgName(f.name))}: ${mapType(f.type, "rust")}`).join(", ");
    lines.push(`impl ${structName} {`);
    lines.push(`    pub fn new(${configArgs}) -> Self {`);
    lines.push(`        Self {`);
    for (const f of adapter.config.required) {
      lines.push(`            ${snakeCase(this.resolveCfgName(f.name))},`);
    }
    lines.push("        }");
    lines.push("    }");
    lines.push("}");
    lines.push("");

    lines.push(`#[async_trait]`);
    lines.push(`impl ${interfaceName} for ${structName} {`);
    for (const fn of mod.functions) {
      const aliasedFn = { ...fn, name: this.resolveFnName(fn.name) };
      if (adapter.implements.includes(fn.name)) {
        lines.push(this.generateAdapterMethod(aliasedFn, structName));
      } else {
        const msg = adapter.does_not_implement?.includes(fn.name)
          ? `Not supported by ${adapter.name}: ${fn.name}`
          : `Not yet implemented: ${fn.name}`;
        lines.push(this.generateUnimplementedMethod(aliasedFn, msg));
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
    const structName = this.resolveClsName(adapter.name, adapter.name);
    const lines: string[] = [
      `// ${adapter.name}_test.rs`,
      `// Do not edit directly. Generated code.`,
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
