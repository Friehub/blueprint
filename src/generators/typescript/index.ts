import type { ModuleContract, ContractFunction, ContractType } from "../../core/catalog.js";
import type { AdapterDefinition } from "../../core/adapters/types.js";
import type { Language, GeneratorContext, GeneratorResult, GeneratedFile, LanguageGenerator } from "../types.js";
import { pascalCase, camelCase, mapType } from "../types.js";
import { generateTypeDefinition, generateFunctionSignature, generateParamsList, generateIndex, getSdkHint, generateSharedTypes } from "./helpers.js";

export class TypeScriptGenerator implements LanguageGenerator {
  language: Language = "typescript";
  name = "TypeScript Generator";

  generateInterfaces(context: GeneratorContext): GeneratorResult {
    const files: GeneratedFile[] = [];
    const errors: string[] = [];
    let modules = this.resolveModules(context);

    files.push({ path: "interfaces/shared.ts", content: generateSharedTypes() });

    for (const mod of modules) {
      try {
        files.push({ path: `interfaces/${mod.name}.ts`, content: this.generateModuleInterface(mod) });
      } catch (error) {
        errors.push(`Failed to generate interface for ${mod.name}: ${error instanceof Error ? error.message : error}`);
      }
    }
    files.push({ path: "interfaces/index.ts", content: generateIndex(modules.map((m) => m.name)) });
    return { files, errors };
  }

  generateAdapter(context: GeneratorContext): GeneratorResult {
    const files: GeneratedFile[] = [];
    const errors: string[] = [];
    const adapters = context.adapters.filter((a) => {
      if (context.module && a.module !== context.module) return false;
      if (context.provider && a.name !== context.provider) return false;
      return true;
    });

    for (const adapter of adapters) {
      try {
        const mod = context.catalog.modules.find((m) => m.name === adapter.module);
        if (!mod) { errors.push(`Module ${adapter.module} not found for adapter ${adapter.name}`); continue; }
        files.push({ path: `adapters/${adapter.module}/${adapter.name}.ts`, content: this.generateAdapterClass(adapter, mod) });
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
      return true;
    });

    for (const adapter of adapters) {
      try {
        const mod = context.catalog.modules.find((m) => m.name === adapter.module);
        if (!mod) { errors.push(`Module ${adapter.module} not found for adapter ${adapter.name}`); continue; }
        files.push({ path: `__tests__/${adapter.module}/${adapter.name}.test.ts`, content: this.generateConformanceTest(adapter, mod) });
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
    const lines: string[] = [
      `// ${mod.name}.ts`,
      `// Auto-generated from contracts/${mod.name}.md`,
      `// Do not edit manually`,
      "",
    ];
    for (const type of mod.types) {
      lines.push(generateTypeDefinition(type));
      lines.push("");
    }
    const interfaceName = `${pascalCase(mod.name)}Contract`;
    lines.push(`export interface ${interfaceName} {`);
    for (const fn of mod.functions) lines.push(generateFunctionSignature(fn));
    lines.push("}");
    return lines.join("\n");
  }

  private generateAdapterClass(adapter: AdapterDefinition, mod: ModuleContract): string {
    const lines: string[] = [
      `// ${adapter.name}.ts`,
      `// Auto-generated adapter for ${adapter.name} → ${mod.name}`,
      `// Do not edit manually`,
      "",
      `import type { ${pascalCase(mod.name)}Contract } from '../interfaces/${mod.name}';`,
      "",
    ];

    const className = `${pascalCase(adapter.name)}Adapter`;
    const configFields = adapter.config.required.map((f) => `  ${f.name}: ${mapType(f.type, "typescript")};`).join("\n");
    lines.push(`export class ${className} implements ${pascalCase(mod.name)}Contract {`);
    lines.push(`  constructor(private config: {`);
    lines.push(configFields);
    lines.push(`  }) {}`);
    lines.push("");

    for (const fn of mod.functions) {
      if (adapter.implements.includes(fn.name)) {
        lines.push(this.generateAdapterMethod(fn, adapter.name));
      } else {
        const notSupportedMessage = adapter.does_not_implement?.includes(fn.name)
          ? `Not supported by ${adapter.name}: ${fn.name}`
          : `Not yet implemented: ${fn.name}`;
        lines.push(this.generateUnimplementedMethod(fn, notSupportedMessage));
      }
    }
    lines.push("}");
    return lines.join("\n");
  }

  private generateAdapterMethod(fn: ContractFunction, adapterName: string): string {
    const lines: string[] = [];
    lines.push(`  async ${camelCase(fn.name)}(${generateParamsList(fn)}): Promise<${mapType(fn.returns, "typescript")}> {`);
    const hint = getSdkHint(adapterName, fn.name);
    if (hint) {
      lines.push(`  // ${hint}`);
      lines.push(`  return ${fn.returns === "void" ? "" : `{} as any`};`);
    } else {
      lines.push(`  throw new Error('Not implemented: ${fn.name}');`);
    }
    lines.push(`}`);
    return lines.join("\n");
  }

  private generateUnimplementedMethod(fn: ContractFunction, message: string): string {
    return `  async ${camelCase(fn.name)}(${generateParamsList(fn)}): Promise<${mapType(fn.returns, "typescript")}> {\n    throw new Error('${message}');\n  }`;
  }

  private generateConformanceTest(adapter: AdapterDefinition, mod: ModuleContract): string {
    const className = `${pascalCase(adapter.name)}Adapter`;
    const interfaceName = `${pascalCase(mod.name)}Contract`;
    const lines: string[] = [
      `// ${adapter.name}.test.ts`,
      `// Auto-generated conformance test for ${adapter.name} → ${mod.name}`,
      "",
      `import { ${className} } from '../adapters/${mod.name}/${adapter.name}';`,
      `import type { ${interfaceName} } from '../interfaces/${mod.name}';`,
      "",
      `describe('${className} implements ${interfaceName}', () => {`,
      `  const adapter: ${interfaceName} = new ${className}({`,
    ];

    const testConfigs = adapter.config.required.map((f) => {
      const val = f.type === "number" ? 0 : "false";
      return `    ${f.name}: 'test'`;
    }).join(",\n");
    lines.push(testConfigs);
    lines.push(`  });`);
    lines.push("");

    for (const fn of mod.functions) {
      lines.push(`  it('has ${fn.name} method', () => {`);
      lines.push(`    expect(typeof adapter.${camelCase(fn.name)}).toBe('function');`);
      lines.push(`  });`);
    }
    lines.push(`});`);
    return lines.join("\n");
  }
}
