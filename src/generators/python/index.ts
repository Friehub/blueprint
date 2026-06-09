import type { ModuleContract, ContractFunction } from "../../core/catalog.js";
import type { AdapterDefinition } from "../../core/adapters/types.js";
import { adapterSupportsLanguage } from "../../core/adapters/types.js";
import type { Language, GeneratorContext, GeneratorResult, GeneratedFile, LanguageGenerator } from "../types.js";
import { pascalCase, snakeCase, mapType } from "../types.js";
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

  generateInterfaces(context: GeneratorContext): GeneratorResult {
    this.context = context;
    const files: GeneratedFile[] = [];
    const errors: string[] = [];
    let modules = this.resolveModules(context);

    files.push({ path: "interfaces/shared.py", content: generateSharedTypes() });

    for (const mod of modules) {
      try {
        files.push({ path: `interfaces/${mod.name}.py`, content: this.generateModuleInterface(mod) });
      } catch (error) {
        errors.push(`Failed to generate interface for ${mod.name}: ${error instanceof Error ? error.message : error}`);
      }
    }
    files.push({ path: "interfaces/__init__.py", content: generateIndex(modules.map((m) => m.name)) });
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
        files.push({ path: `adapters/${adapter.module}/${adapter.name}.py`, content: this.generateAdapterClass(adapter, mod) });
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
        files.push({ path: `__tests__/${adapter.module}/${adapter.name}_test.py`, content: this.generateConformanceTest(adapter, mod) });
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
      `# ${mod.name}.py — ${versionNote} — contracts/${mod.name}.md`,
      `# Auto-generated from contracts/${mod.name}.md -- namespace: "${this.context?.namespace ?? "none"}"`,
      `# Types are inferred from naming conventions. Review before production use.`,
      "",
      "from typing import Optional, Literal",
      "from dataclasses import dataclass",
      "from abc import ABC, abstractmethod",
      "from datetime import datetime",
      "",
    ];
    for (const type of mod.types) {
      const defn = generateTypeDefinition(type);
      lines.push(defn);
      lines.push("");
    }
    const interfaceName = `${ns}${pascalCase(mod.name)}Contract`;
    lines.push(`class ${interfaceName}(ABC):`);
    for (const fn of mod.functions) lines.push(generateFunctionSignature(fn));
    lines.push("");
    lines.push(generateErrorHierarchy(mod.name));
    return lines.join("\n");
  }

  private generateAdapterClass(adapter: AdapterDefinition, mod: ModuleContract): string {
    const ns = this.context?.namespace ? `${pascalCase(this.context.namespace)}_` : "";
    const modulePascal = pascalCase(mod.name);
    const adapterPascal = pascalCase(adapter.name);
    const lines: string[] = [
      `# ${adapter.name}.py`,
      `# Auto-generated adapter for ${adapter.name} → ${mod.name} -- namespace: "${this.context?.namespace ?? "none"}"`,
      "",
      `from typing import Optional`,
      `from interfaces.${mod.name} import ${ns}${modulePascal}Contract`,
      "",
    ];

    const className = `${ns}${adapterPascal}Adapter`;
    lines.push(`class ${className}(${modulePascal}Contract):`);
    lines.push("");

    const configFields = adapter.config.required.map((f) => {
      const pyType = mapType(f.type, "python");
      return `        self.${snakeCase(f.name)} = ${snakeCase(f.name)}`;
    }).join("\n");
    if (configFields) {
      lines.push(`    def __init__(self, ${adapter.config.required.map((f) => `${snakeCase(f.name)}: ${mapType(f.type, "python")}`).join(", ")}):`);
      lines.push(configFields);
      lines.push("");
    }

    for (const fn of mod.functions) {
      if (adapter.implements.includes(fn.name)) {
        lines.push(this.generateAdapterMethod(fn));
      } else {
        const notSupportedMessage = adapter.does_not_implement?.includes(fn.name)
          ? `Not supported by ${adapter.name}: ${fn.name}`
          : `Not yet implemented: ${fn.name}`;
        lines.push(this.generateUnimplementedMethod(fn, notSupportedMessage));
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
    const modulePascal = pascalCase(mod.name);
    const adapterPascal = pascalCase(adapter.name);
    const className = `${adapterPascal}Adapter`;
    const lines: string[] = [
      `# ${adapter.name}_test.py`,
      `# Auto-generated conformance test for ${adapter.name} → ${mod.name}`,
      "",
      "import pytest",
      `from interfaces.${mod.name} import ${modulePascal}Contract`,
      `from adapters.${mod.name}.${adapter.name} import ${className}`,
      "",
      `class Test${className}:`,
      "",
    ];

    const testConfigArgs = adapter.config.required.map((f) => `${snakeCase(f.name)}="test"`).join(", ");
    lines.push(`    def setup_method(self):`);
    lines.push(`        self.adapter = ${className}(${testConfigArgs})`);
    lines.push("");
    lines.push(`    def test_implements_contract(self):`);
    lines.push(`        assert isinstance(self.adapter, ${modulePascal}Contract)`);
    lines.push("");

    for (const fn of mod.functions) {
      lines.push(`    def test_has_${snakeCase(fn.name)}_method(self):`);
      lines.push(`        assert hasattr(self.adapter, "${snakeCase(fn.name)}")`);
      lines.push("");
    }
    return lines.join("\n");
  }
}
