import type { ModuleContract, ContractFunction, ContractType, AlgorithmInfo } from "../../core/catalog.js";
import type { AdapterDefinition } from "../../core/adapters/types.js";
import { adapterSupportsLanguage } from "../../core/adapters/types.js";
import type { Language, GeneratorContext, GeneratorResult, GeneratedFile, LanguageGenerator } from "../types.js";
import { pascalCase, camelCase, mapType } from "../types.js";
import { resolveAlias, resolveModuleAlias, resolveClassAlias, resolveConfigAlias, obfuscateName } from "../aliases.js";
import { generateTypeDefinition, generateFunctionSignature, generateParamsList, generateIndex, generateIndexCjs, getSdkHint, generateSharedTypes, generateZodSchema, generateEventTypes, generateTranslateMethod } from "./helpers.js";

const SDK_IMPORTS: Record<string, string> = {
  stripe: `import Stripe from 'stripe';`,
  redis: `import { createClient } from 'redis';`,
  bullmq: `import { Queue, Worker, Job } from 'bullmq';`,
  sendgrid: `import sgMail from '@sendgrid/mail';`,
  resend: `import { Resend } from 'resend';`,
  twilio: `import twilio from 'twilio';`,
  memcached: `import Memcached from 'memcached';`,
  sqs: `import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';`,
  sentry: `import * as Sentry from '@sentry/node';`,
  clerk: `import { createClerkClient } from '@clerk/clerk-sdk-node';`,
  sift: `import { SiftClient } from 'sift';`,
  cloudinary: `import { v2 as cloudinary } from 'cloudinary';`,
  algolia: `import { algoliasearch } from 'algoliasearch';`,
};

function getSdkImport(adapterName: string): string {
  return SDK_IMPORTS[adapterName] || `// TODO: import ${adapterName} SDK`;
}

export class TypeScriptGenerator implements LanguageGenerator {
  language: Language = "typescript";
  name = "TypeScript Generator";
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

    files.push({ path: this.nsPath("interfaces/shared.ts"), content: generateSharedTypes() });

    for (const mod of modules) {
      try {
        const aliasedName = this.resolveModName(mod.name);
        files.push({ path: this.nsPath(`interfaces/${aliasedName}.ts`), content: this.generateModuleInterface(mod) });
        files.push({ path: this.nsPath(`graphql/${aliasedName}.graphql`), content: this.generateGraphQLTypes(mod) });
        files.push({ path: this.nsPath(`interfaces/${aliasedName}.zod.ts`), content: this.generateZodTypes(mod) });
        files.push({ path: this.nsPath(`interfaces/${aliasedName}.events.ts`), content: generateEventTypes(mod) });
      } catch (error) {
        errors.push(`Failed to generate interface for ${mod.name}: ${error instanceof Error ? error.message : error}`);
      }
    }
    const names = modules.map((m) => this.resolveModName(m.name));
    files.push({ path: this.nsPath("interfaces/index.ts"), content: generateIndex(names) });
    files.push({ path: this.nsPath("interfaces/index.cjs"), content: generateIndexCjs(names) });
    files.push({ path: this.nsPath("interfaces/package.json"), content: this.generatePackageJson(names) });
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
        const aliasedMod = this.resolveModName(adapter.module);
        files.push({ path: this.nsPath(`adapters/${aliasedMod}/${adapter.name}.ts`), content: this.generateAdapterClass(adapter, mod) });
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
        const aliasedMod = this.resolveModName(adapter.module);
        files.push({ path: this.nsPath(`__tests__/${aliasedMod}/${adapter.name}.test.ts`), content: this.generateConformanceTest(adapter, mod) });
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
    const aliasedModName = pascalCase(this.resolveModName(mod.name));
    const lines: string[] = [
      `// ${ns}${aliasedModName}Contract`,
      `// Do not edit directly. Generated code.`,
      "",
    ];

    if (mod.algorithm) {
      lines.push(...this.generateAlgorithmComments(mod.algorithm));
      lines.push("");
    }

    for (const type of mod.types) {
      lines.push(generateTypeDefinition(type));
      lines.push("");
    }
    const interfaceName = `${ns}${aliasedModName}Contract`;
    lines.push(`export interface ${interfaceName} {`);
    for (const fn of mod.functions) {
      const aliasedFn = { ...fn, name: this.resolveFnName(fn.name) };
      lines.push(generateFunctionSignature(aliasedFn));
    }
    lines.push("}");
    return lines.join("\n");
  }

  private generatePackageJson(_moduleNames: string[]): string {
    const pkg: Record<string, unknown> = {
      name: "@blueprint/interfaces",
      version: "0.0.0",
      type: "module",
      main: "./index.cjs",
      module: "./index.js",
      types: "./index.ts",
      exports: {
        ".": { types: "./index.ts", import: "./index.js", require: "./index.cjs" },
        "./*": { types: "./*.ts", import: "./*.js", require: "./*.cjs" },
      },
    };
    return JSON.stringify(pkg, null, 2);
  }

  private generateZodTypes(mod: ModuleContract): string {
    const lines: string[] = [
      `// ${pascalCase(mod.name)} Zod Schemas`,
      `// Do not edit directly. Generated code.`,
      "",
      `import { z } from 'zod';`,
      "",
    ];
    for (const type of mod.types) {
      lines.push(generateZodSchema(type));
      lines.push("");
    }
    return lines.join("\n");
  }

  private generateGraphQLTypes(mod: ModuleContract): string {
    const lines: string[] = [
      `# ${mod.name} GraphQL types`,
      `# Auto-generated from Blueprint contract`,
      "",
    ];

    for (const type of mod.types) {
      const raw = type.raw;
      if (raw.includes("{")) {
        const match = raw.match(/\{([^}]+)\}/s);
        const body = match?.[1];
        if (body) {
          const fields = body.split(",").map((f) => f.trim()).filter(Boolean);
          lines.push(`type ${type.name} {`);
          for (const field of fields) {
            const clean = field.replace(/\?$/, "");
            const optional = field.endsWith("?");
            const gqlType = this.toGraphQLType(clean);
            if (gqlType.endsWith("]")) {
              lines.push(`  ${clean}: [${gqlType.slice(0, -1)}]${optional ? "" : "!"}`);
            } else {
              lines.push(`  ${clean}: ${gqlType}${optional ? "" : "!"}`);
            }
          }
          lines.push("}");
          lines.push("");
        }
      } else if (raw.startsWith("type ")) {
        const parts = raw.replace("type ", "").split("=");
        if (parts.length === 2) {
          const body = parts[1] || "";
          const values = body.split("|").map((s) => s.trim()).filter((s) => s);
          if (values.length > 0 && values.every((v) => /^[a-zA-Z]/.test(v))) {
            lines.push(`enum ${type.name} {`);
            for (const val of values) {
              lines.push(`  ${val.replace(/\s+/g, "_").toUpperCase()}`);
            }
            lines.push("}");
            lines.push("");
          }
        }
      }
    }

    const queryFields: string[] = [];
    const mutationFields: string[] = [];
    for (const fn of mod.functions) {
      const aliasedName = this.resolveFnName(fn.name);
      const args = fn.params.map((p) => `$${p.name}: ${this.toGraphQLInputType(p.type || "string")}`).join(", ");
      const ret = fn.returns;
      if (fn.name.startsWith("get") || fn.name.startsWith("list") || fn.name.startsWith("search") || fn.name.startsWith("find")) {
        queryFields.push(`  ${aliasedName}(${args}): ${ret}`);
      } else {
        mutationFields.push(`  ${aliasedName}(${args}): ${ret}`);
      }
    }

    if (queryFields.length > 0) {
      lines.push(`type Query {`);
      lines.push(...queryFields);
      lines.push("}");
      lines.push("");
    }
    if (mutationFields.length > 0) {
      lines.push(`type Mutation {`);
      lines.push(...mutationFields);
      lines.push("}");
      lines.push("");
    }

    return lines.join("\n");
  }

  private toGraphQLType(fieldName: string): string {
    if (fieldName.endsWith("_at") || fieldName === "created_at" || fieldName === "updated_at") return "String";
    if (fieldName.endsWith("_count")) return "Int";
    if (fieldName.endsWith("_amount") || fieldName.endsWith("_price") || fieldName.endsWith("_total")) return "Float";
    if (fieldName.startsWith("is_") || fieldName.startsWith("has_")) return "Boolean";
    if (fieldName.endsWith("_id") || fieldName === "id") return "ID";
    if (fieldName.endsWith("[]")) return `[${this.toGraphQLType(fieldName.slice(0, -2))}]`;
    return "String";
  }

  private toGraphQLInputType(type: string): string {
    const map: Record<string, string> = {
      string: "String", number: "Float", boolean: "Boolean", integer: "Int",
    };
    return map[type] || type;
  }

  private generateAlgorithmComments(algorithm: AlgorithmInfo): string[] {
    const lines: string[] = [
      "/*",
      " * Algorithm Recommendations",
      " * ─────────────────────────",
    ];

    if (algorithm.recommended) {
      lines.push(` * Recommended: ${algorithm.recommended}`);
    }

    if (algorithm.details) {
      lines.push(` * Details: ${algorithm.details}`);
    }

    if (algorithm.atomicity) {
      lines.push(` * Atomicity: ${algorithm.atomicity}`);
    }

    lines.push(" */");
    return lines;
  }

  private generateAdapterClass(adapter: AdapterDefinition, mod: ModuleContract): string {
    const ns = this.context?.namespace ? `${pascalCase(this.context.namespace)}_` : "";
    const aliasedModName = pascalCase(this.resolveModName(mod.name));
    const aliasedInterface = `${ns}${aliasedModName}Contract`;
    const className = `${ns}${this.resolveClsName(adapter.name, adapter.name)}`;
    const lines: string[] = [
      `// ${adapter.name}.ts`,
      `// Do not edit directly. Generated code.`,
      "",
      getSdkImport(adapter.name),
      `import type { ${aliasedInterface} } from '../interfaces/${this.resolveModName(mod.name)}';`,
      `import { trace, SpanStatusCode } from '@opentelemetry/api';`,
      `import { ContractError } from '../interfaces/shared.js';`,
      "",
    ];

    const configFields = adapter.config.required.map((f) => `  ${this.resolveCfgName(f.name)}: ${mapType(f.type, "typescript")};`).join("\n");
    lines.push(`export class ${className} implements ${aliasedInterface} {`);
    lines.push(`  private tracer = trace.getTracer('${adapter.name}');`);
    lines.push("");

    if (configFields) {
      lines.push(`  constructor(private config: {`);
      lines.push(configFields);
      lines.push(`  }) {}`);
    } else {
      lines.push(`  constructor(private config: Record<string, never> = {}) {}`);
    }
    lines.push("");

    lines.push(generateTranslateMethod(adapter.name, mod));
    lines.push("");

    for (const fn of mod.functions) {
      const aliasedName = this.resolveFnName(fn.name);
      const aliasedFn = { ...fn, name: aliasedName };
      if (adapter.implements.includes(fn.name)) {
        lines.push(this.generateAdapterMethod(aliasedFn, adapter.name));
      } else {
        const notSupportedMessage = adapter.does_not_implement?.includes(fn.name)
          ? `Not supported by ${adapter.name}: ${fn.name}`
          : `Not yet implemented: ${fn.name}`;
        lines.push(this.generateUnimplementedMethod(aliasedFn, notSupportedMessage));
      }
    }
    lines.push("}");
    return lines.join("\n");
  }

  private generateAdapterMethod(fn: ContractFunction, adapterName: string): string {
    const lines: string[] = [];
    const returnType = mapType(fn.returns, "typescript");
    lines.push(`  async ${camelCase(fn.name)}(${generateParamsList(fn)}): Promise<${returnType}> {`);
    lines.push(`    const span = this.tracer.startSpan('${adapterName}.${fn.name}');`);
    lines.push(`    span.setAttribute('function.name', '${fn.name}');`);
    lines.push(`    span.setAttribute('adapter.name', '${adapterName}');`);
    lines.push(`    try {`);
    const hint = getSdkHint(adapterName, fn.name);
    if (hint) {
      const hintLines = hint.split("\n");
      for (const hintLine of hintLines) {
        const trimmed = hintLine.trim();
        if (trimmed) lines.push(`      ${hintLine}`);
      }
    } else {
      lines.push(`      // TODO: Implement ${fn.name}`);
      if (fn.returns !== "void") {
        lines.push(`      throw new Error('Not implemented: ${fn.name}');`);
      }
    }
    lines.push(`      span.setStatus({ code: SpanStatusCode.OK });`);
    lines.push(`    } catch (error) {`);
    lines.push(`      span.recordException(error instanceof Error ? error : new Error(String(error)));`);
    lines.push(`      span.setStatus({ code: SpanStatusCode.ERROR, message: (error instanceof Error ? error.message : String(error)) });`);
    lines.push(`      this.translateError(error, '${fn.name}');`);
    lines.push(`    } finally {`);
    lines.push(`      span.end();`);
    lines.push(`    }`);
    lines.push(`  }`);
    return lines.join("\n");
  }

  private generateUnimplementedMethod(fn: ContractFunction, message: string): string {
    return `  async ${camelCase(fn.name)}(${generateParamsList(fn)}): Promise<${mapType(fn.returns, "typescript")}> {\n    throw new Error('${message}');\n  }`;
  }

  private generateConformanceTest(adapter: AdapterDefinition, mod: ModuleContract): string {
    const aliasedModName = this.resolveModName(mod.name);
    const aliasedInterface = `${pascalCase(aliasedModName)}Contract`;
    const className = this.resolveClsName(adapter.name, adapter.name);
    const lines: string[] = [
      `// ${adapter.name}.test.ts`,
      `// Do not edit directly. Generated code.`,
      "",
      `import { ${className} } from '../adapters/${aliasedModName}/${adapter.name}';`,
      `import type { ${aliasedInterface} } from '../interfaces/${aliasedModName}';`,
      "",
      `describe('${className} implements ${aliasedInterface}', () => {`,
      `  const adapter: ${aliasedInterface} = new ${className}({`,
    ];

    const testConfigs = adapter.config.required.map((f) => {
      return `    ${this.resolveCfgName(f.name)}: 'test'`;
    }).join(",\n");
    lines.push(testConfigs);
    lines.push(`  });`);
    lines.push("");

    for (const fn of mod.functions) {
      const aliasedName = this.resolveFnName(fn.name);
      lines.push(`  it('has ${aliasedName} method', () => {`);
      lines.push(`    expect(typeof adapter.${aliasedName}).toBe('function');`);
      lines.push(`  });`);
    }
    lines.push(`});`);
    return lines.join("\n");
  }
}
