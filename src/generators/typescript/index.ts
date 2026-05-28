import type { ModuleContract, ContractFunction, ContractType } from "../../core/catalog.js";
import type { AdapterDefinition } from "../../core/adapters/types.js";
import type {
  Language,
  GeneratorContext,
  GeneratorResult,
  GeneratedFile,
  LanguageGenerator,
} from "../types.js";
import { pascalCase, camelCase, mapType, createTemplateData } from "../types.js";

export class TypeScriptGenerator implements LanguageGenerator {
  language: Language = "typescript";
  name = "TypeScript Generator";

  generateInterfaces(context: GeneratorContext): GeneratorResult {
    const files: GeneratedFile[] = [];
    const errors: string[] = [];
    const modules = context.module
      ? context.catalog.modules.filter((m) => m.name === context.module)
      : context.catalog.modules;

    for (const mod of modules) {
      try {
        const content = this.generateModuleInterface(mod);
        files.push({
          path: `interfaces/${mod.name}.ts`,
          content,
        });
      } catch (error) {
        errors.push(`Failed to generate interface for ${mod.name}: ${error instanceof Error ? error.message : error}`);
      }
    }

    const indexContent = this.generateIndex(modules.map((m) => m.name));
    files.push({
      path: "interfaces/index.ts",
      content: indexContent,
    });

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
        if (!mod) {
          errors.push(`Module ${adapter.module} not found for adapter ${adapter.name}`);
          continue;
        }

        const content = this.generateAdapterClass(adapter, mod);
        files.push({
          path: `adapters/${adapter.module}/${adapter.name}.ts`,
          content,
        });
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
        if (!mod) {
          errors.push(`Module ${adapter.module} not found for adapter ${adapter.name}`);
          continue;
        }

        const content = this.generateConformanceTest(adapter, mod);
        files.push({
          path: `__tests__/${adapter.module}/${adapter.name}.test.ts`,
          content,
        });
      } catch (error) {
        errors.push(`Failed to generate test for ${adapter.name}: ${error instanceof Error ? error.message : error}`);
      }
    }

    return { files, errors };
  }

  private generateModuleInterface(mod: ModuleContract): string {
    const lines: string[] = [];

    lines.push(`// ${mod.name}.ts`);
    lines.push(`// Auto-generated from contracts/${mod.name}.md`);
    lines.push(`// Do not edit manually`);
    lines.push("");

    for (const type of mod.types) {
      lines.push(this.generateTypeDefinition(type));
      lines.push("");
    }

    const interfaceName = `${pascalCase(mod.name)}Contract`;
    lines.push(`export interface ${interfaceName} {`);

    for (const fn of mod.functions) {
      lines.push(this.generateFunctionSignature(fn));
    }

    lines.push("}");
    lines.push("");

    return lines.join("\n");
  }

  private generateTypeDefinition(type: ContractType): string {
    const name = pascalCase(type.name);
    const raw = type.raw;

    if (raw.includes("{")) {
      return `export interface ${name} ${raw}`;
    }

    return `export type ${name} = ${raw};`;
  }

  private generateFunctionSignature(fn: ContractFunction): string {
    const params = fn.params
      .map((p) => {
        const type = p.type ? `: ${mapType(p.type, "typescript")}` : ": unknown";
        const optional = p.optional ? "?" : "";
        return `${camelCase(p.name)}${optional}${type}`;
      })
      .join(", ");

    const returnType = mapType(fn.returns, "typescript");
    return `  ${camelCase(fn.name)}(${params}): Promise<${returnType}>;`;
  }

  private generateAdapterClass(adapter: AdapterDefinition, mod: ModuleContract): string {
    const lines: string[] = [];
    const className = `${pascalCase(adapter.name)}Adapter`;
    const interfaceName = `${pascalCase(mod.name)}Contract`;

    lines.push(`// ${adapter.name}.ts`);
    lines.push(`// Auto-generated adapter for ${adapter.name} → ${mod.name}`);
    lines.push(`// Do not edit manually`);
    lines.push("");
    lines.push(`import type { ${interfaceName} } from '../interfaces/${mod.name}';`);
    lines.push("");

    const configFields = adapter.config.required
      .map((f) => `  ${f.name}: ${mapType(f.type, "typescript")};`)
      .join("\n");

    lines.push(`export class ${className} implements ${interfaceName} {`);
    lines.push(`  constructor(private config: {`);
    lines.push(configFields);
    lines.push(`  }) {}`);
    lines.push("");

    for (const fn of mod.functions) {
      if (adapter.implements.includes(fn.name)) {
        lines.push(this.generateAdapterMethod(fn, "  "));
      } else if (!adapter.does_not_implement?.includes(fn.name)) {
        lines.push(this.generateUnimplementedMethod(fn, "  "));
      }
    }

    lines.push("}");
    lines.push("");

    return lines.join("\n");
  }

  private generateFunctionSignatureNoReturn(fn: ContractFunction, indent: string): string {
    const params = fn.params
      .map((p) => {
        const type = p.type ? `: ${mapType(p.type, "typescript")}` : ": unknown";
        const optional = p.optional ? "?" : "";
        return `${camelCase(p.name)}${optional}${type}`;
      })
      .join(", ");

    const returnType = mapType(fn.returns, "typescript");
    return `${indent}${camelCase(fn.name)}(${params}): Promise<${returnType}> {`;
  }

  private generateAdapterMethod(fn: ContractFunction, indent: string): string {
    const lines: string[] = [];
    lines.push(`${indent}${camelCase(fn.name)}(${this.generateParamsList(fn)}): Promise<${mapType(fn.returns, "typescript")}> {`);
    lines.push(`${indent}  // TODO: Implement with ${fn.name}`);
    lines.push(`${indent}  throw new Error('Not implemented');`);
    lines.push(`${indent}}`);
    return lines.join("\n");
  }

  private generateUnimplementedMethod(fn: ContractFunction, indent: string): string {
    const lines: string[] = [];
    lines.push(`${indent}${camelCase(fn.name)}(${this.generateParamsList(fn)}): Promise<${mapType(fn.returns, "typescript")}> {`);
    lines.push(`${indent}  throw new Error('Not implemented by this adapter');`);
    lines.push(`${indent}}`);
    return lines.join("\n");
  }

  private generateParamsList(fn: ContractFunction): string {
    return fn.params
      .map((p) => {
        const type = p.type ? `: ${mapType(p.type, "typescript")}` : ": unknown";
        const optional = p.optional ? "?" : "";
        return `${camelCase(p.name)}${optional}${type}`;
      })
      .join(", ");
  }

  private generateConformanceTest(adapter: AdapterDefinition, mod: ModuleContract): string {
    const lines: string[] = [];
    const className = `${pascalCase(adapter.name)}Adapter`;
    const interfaceName = `${pascalCase(mod.name)}Contract`;

    lines.push(`// ${adapter.name}.test.ts`);
    lines.push(`// Auto-generated conformance test for ${adapter.name} → ${mod.name}`);
    lines.push(`// Do not edit manually`);
    lines.push("");
    lines.push(`import { ${className} } from '../adapters/${mod.name}/${adapter.name}';`);
    lines.push(`import type { ${interfaceName} } from '../interfaces/${mod.name}';`);
    lines.push("");
    lines.push(`describe('${className} implements ${interfaceName}', () => {`);

    const configFields = adapter.config.required
      .map((f) => {
        if (f.type === "string") return `    ${f.name}: 'test'`;
        if (f.type === "number") return `    ${f.name}: 0`;
        if (f.type === "boolean") return `    ${f.name}: false`;
        return `    ${f.name}: 'test'`;
      })
      .join(",\n");

    lines.push(`  const adapter: ${interfaceName} = new ${className}({`);
    lines.push(configFields);
    lines.push(`  });`);
    lines.push("");

    for (const fn of mod.functions) {
      lines.push(`  it('has ${fn.name} method', () => {`);
      lines.push(`    expect(typeof adapter.${camelCase(fn.name)}).toBe('function');`);
      lines.push(`  });`);
      lines.push("");
    }

    lines.push("});");
    lines.push("");

    return lines.join("\n");
  }

  private generateIndex(moduleNames: string[]): string {
    const lines: string[] = [];
    lines.push("// Auto-generated module index");
    lines.push("// Do not edit manually");
    lines.push("");

    for (const name of moduleNames.sort()) {
      lines.push(`export * from './${name}';`);
    }

    return lines.join("\n");
  }
}
