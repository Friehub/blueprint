import type { ModuleContract, ContractFunction, AlgorithmInfo } from "../../core/catalog.js";
import type { AdapterDefinition } from "../../core/adapters/types.js";
import { adapterSupportsLanguage } from "../../core/adapters/types.js";
import type { Language, GeneratorContext, GeneratorResult, GeneratedFile, LanguageGenerator } from "../types.js";
import { pascalCase, snakeCase, mapType } from "../types.js";
import { resolveAlias, resolveModuleAlias, resolveClassAlias, resolveConfigAlias, obfuscateName } from "../aliases.js";
import {
  generateTypeDefinition,
  generateFunctionSignature,
  generateParamsList,
  generateErrorHierarchy,
  generateSharedTypes,
  generateIndex,
} from "./helpers.js";

export class PythonGenerator implements LanguageGenerator {
  language: Language = "python";
  name = "Python Generator";
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

    files.push({ path: this.nsPath("interfaces/shared.py"), content: generateSharedTypes() });

    for (const mod of modules) {
      try {
        files.push({ path: this.nsPath(`interfaces/${this.resolveModName(mod.name)}.py`), content: this.generateModuleInterface(mod) });
      } catch (error) {
        errors.push(`Failed to generate interface for ${mod.name}: ${error instanceof Error ? error.message : error}`);
      }
    }
    files.push({ path: this.nsPath("interfaces/__init__.py"), content: generateIndex(modules.map((m) => m.name)) });
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
        files.push({ path: this.nsPath(`adapters/${this.resolveModName(adapter.module)}/${adapter.name}.py`), content: this.generateAdapterClass(adapter, mod) });
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
        files.push({ path: this.nsPath(`__tests__/${this.resolveModName(adapter.module)}/${adapter.name}_test.py`), content: this.generateConformanceTest(adapter, mod) });
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
      `# ${ns}${pascalCase(this.resolveModName(mod.name))}Contract`,
      `# Do not edit directly. Generated code.`,
      "",
    ];

    if (mod.algorithm) {
      lines.push(...this.generateAlgorithmDocstring(mod.algorithm));
      lines.push("");
    }

    lines.push("from typing import Optional, Literal");
    lines.push("from dataclasses import dataclass");
    lines.push("from abc import ABC, abstractmethod");
    lines.push("from datetime import datetime");
    lines.push("");

    for (const type of mod.types) {
      const defn = generateTypeDefinition(type);
      lines.push(defn);
      lines.push("");
    }
    const interfaceName = `${ns}${pascalCase(this.resolveModName(mod.name))}Contract`;
    lines.push(`class ${interfaceName}(ABC):`);
    for (const fn of mod.functions) {
      const aliasedFn = { ...fn, name: this.resolveFnName(fn.name) };
      lines.push(generateFunctionSignature(aliasedFn));
    }
    lines.push("");
    lines.push(generateErrorHierarchy(mod.name));
    return lines.join("\n");
  }

  private generateAlgorithmDocstring(algorithm: AlgorithmInfo): string[] {
    const lines: string[] = [
      '"""',
      "Algorithm Recommendations",
      "─────────────────────────",
    ];

    if (algorithm.recommended) {
      lines.push(`Recommended: ${algorithm.recommended}`);
    }

    if (algorithm.details) {
      lines.push(`Details: ${algorithm.details}`);
    }

    if (algorithm.atomicity) {
      lines.push(`Atomicity: ${algorithm.atomicity}`);
    }

    lines.push('"""');
    return lines;
  }

  private generateAdapterClass(adapter: AdapterDefinition, mod: ModuleContract): string {
    const ns = this.context?.namespace ? `${pascalCase(this.context.namespace)}_` : "";
    const modulePascal = pascalCase(this.resolveModName(mod.name));
    const adapterPascal = pascalCase(adapter.name);
    const lines: string[] = [
      `# ${adapter.name}.py`,
      `# Do not edit directly. Generated code.`,
      "",
      `from typing import Optional`,
      `from interfaces.${this.resolveModName(mod.name)} import ${ns}${modulePascal}Contract`,
      "",
    ];

    const className = `${ns}${this.resolveClsName(adapter.name, adapter.name)}`;
    lines.push(`class ${className}(${modulePascal}Contract):`);
    lines.push("");

    const configFields = adapter.config.required.map((f) => {
      const aliased = snakeCase(this.resolveCfgName(f.name));
      return `        self.${aliased} = ${aliased}`;
    }).join("\n");
    if (configFields) {
      lines.push(`    def __init__(self, ${adapter.config.required.map((f) => `${snakeCase(this.resolveCfgName(f.name))}: ${mapType(f.type, "python")}`).join(", ")}):`);
      lines.push(configFields);
      lines.push("");
    }

    for (const fn of mod.functions) {
      const aliasedFn = { ...fn, name: this.resolveFnName(fn.name) };
      if (adapter.implements.includes(fn.name)) {
        lines.push(this.generateAdapterMethod(aliasedFn));
      } else {
        const notSupportedMessage = adapter.does_not_implement?.includes(fn.name)
          ? `Not supported by ${adapter.name}: ${fn.name}`
          : `Not yet implemented: ${fn.name}`;
        lines.push(this.generateUnimplementedMethod(aliasedFn, notSupportedMessage));
      }
    }
    return lines.join("\n");
  }

  private generateAdapterMethod(fn: ContractFunction): string {
    const returnType = mapType(fn.returns, "python");
    const params = generateParamsList(fn);
    const lines: string[] = [];
    lines.push(`    async def ${snakeCase(fn.name)}(self, ${params}) -> ${returnType}:`);
    lines.push(`        # TODO: Implement ${fn.name}`);
    if (fn.returns !== "void" && fn.returns !== "None") {
      lines.push(`        raise NotImplementedError("${fn.name}")`);
    }
    return lines.join("\n");
  }

  private generateUnimplementedMethod(fn: ContractFunction, message: string): string {
    const returnType = mapType(fn.returns, "python");
    const params = generateParamsList(fn);
    return `    async def ${snakeCase(fn.name)}(self, ${params}) -> ${returnType}:\n        raise NotImplementedError("${message}")`;
  }

  private generateConformanceTest(adapter: AdapterDefinition, mod: ModuleContract): string {
    const modulePascal = pascalCase(this.resolveModName(mod.name));
    const adapterPascal = pascalCase(adapter.name);
    const className = this.resolveClsName(adapter.name, adapter.name);
    const lines: string[] = [
      `# ${adapter.name}_test.py`,
      `# Do not edit directly. Generated code.`,
      "",
      "import pytest",
      `from interfaces.${this.resolveModName(mod.name)} import ${modulePascal}Contract`,
      `from adapters.${this.resolveModName(mod.name)}.${adapter.name} import ${className}`,
      "",
      `class Test${className}:`,
      "",
    ];

    const testConfigArgs = adapter.config.required.map((f) => `${snakeCase(this.resolveCfgName(f.name))}="test"`).join(", ");
    lines.push(`    def setup_method(self):`);
    lines.push(`        self.adapter = ${className}(${testConfigArgs})`);
    lines.push("");
    lines.push(`    def test_implements_contract(self):`);
    lines.push(`        assert isinstance(self.adapter, ${modulePascal}Contract)`);
    lines.push("");

    for (const fn of mod.functions) {
      const aliasedName = this.resolveFnName(fn.name);
      lines.push(`    def test_has_${aliasedName}_method(self):`);
      lines.push(`        assert hasattr(self.adapter, "${aliasedName}")`);
      lines.push("");
    }
    return lines.join("\n");
  }
}
