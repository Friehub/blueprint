import type { ModuleContract, ContractFunction, ContractType } from "../../core/catalog.js";
import type { AdapterDefinition } from "../../core/adapters/types.js";
import type {
  Language,
  GeneratorContext,
  GeneratorResult,
  GeneratedFile,
  LanguageGenerator,
} from "../types.js";
import { pascalCase, camelCase, mapType, inferType, createTemplateData } from "../types.js";

export class TypeScriptGenerator implements LanguageGenerator {
  language: Language = "typescript";
  name = "TypeScript Generator";

  generateInterfaces(context: GeneratorContext): GeneratorResult {
    const files: GeneratedFile[] = [];
    const errors: string[] = [];
    
    let modules = context.module
      ? context.catalog.modules.filter((m) => m.name === context.module)
      : context.catalog.modules;

    if (context.module) {
      const targetMod = context.catalog.modules.find((m) => m.name === context.module);
      if (targetMod) {
        const depNames = new Set<string>();
        for (const dep of targetMod.hardDeps) {
          if (!depNames.has(dep)) {
            depNames.add(dep);
            const depMod = context.catalog.modules.find((m) => m.name === dep);
            if (depMod && !modules.some((m) => m.name === dep)) {
              modules = [...modules, depMod];
            }
          }
        }
      }
    }

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

    if (raw.startsWith("type ")) {
      return `export ${raw}`;
    }

    if (raw.includes("{")) {
      const fields = this.parseTypeFields(raw);
      const fieldsStr = fields
        .map((f) => {
          const type = f.type ? `: ${mapType(f.type, "typescript")}` : `: ${inferType(f.name, "typescript")}`;
          const optional = f.optional ? "?" : "";
          return `  ${camelCase(f.name)}${optional}${type};`;
        })
        .join("\n");
      return `export interface ${name} {\n${fieldsStr}\n}`;
    }

    const fieldsMatch = raw.match(/^\w+\s*\{\s*(.+)\s*\}$/);
    if (fieldsMatch) {
      const fields = fieldsMatch[1]?.split(",").map((f) => f.trim()) ?? [];
      const fieldsStr = fields
        .map((f) => {
          const optional = f.endsWith("?");
          const fieldName = f.replace(/\?$/, "");
          return `  ${camelCase(fieldName)}${optional ? "?" : ""}: ${inferType(fieldName, "typescript")};`;
        })
        .join("\n");
      return `export interface ${name} {\n${fieldsStr}\n}`;
    }

    return `export type ${name} = ${raw};`;
  }

  private parseTypeFields(raw: string): Array<{ name: string; type: string | null; optional: boolean }> {
    const fields: Array<{ name: string; type: string | null; optional: boolean }> = [];
    const match = raw.match(/\{([^}]+)\}/s);
    if (!match) return fields;

    const content = match[1] ?? "";
    const fieldLines = content.split(/[,\n]/).filter((l) => l.trim());

    for (const line of fieldLines) {
      const trimmed = line.trim().replace(/,\s*$/, "").replace(/\/\/.*$/, "").trim();
      if (!trimmed) continue;

      const typeMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/);
      if (typeMatch) {
        fields.push({
          name: typeMatch[1] ?? "",
          type: typeMatch[2]?.trim() ?? null,
          optional: false,
        });
        continue;
      }

      const optionalMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\?\s*:\s*(.+)$/);
      if (optionalMatch) {
        fields.push({
          name: optionalMatch[1] ?? "",
          type: optionalMatch[2]?.trim() ?? null,
          optional: true,
        });
        continue;
      }

      const simpleMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)$/);
      if (simpleMatch) {
        fields.push({
          name: simpleMatch[1] ?? "",
          type: null,
          optional: trimmed.endsWith("?"),
        });
      }
    }

    return fields;
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
        lines.push(this.generateAdapterMethod(fn, adapter.name, "  "));
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

  private generateAdapterMethod(fn: ContractFunction, adapterName: string, indent: string): string {
    const lines: string[] = [];
    lines.push(`${indent}${camelCase(fn.name)}(${this.generateParamsList(fn)}): Promise<${mapType(fn.returns, "typescript")}> {`);
    
    const sdkHint = getSdkHint(adapterName, fn.name);
    if (sdkHint) {
      lines.push(`${indent}  // ${sdkHint}`);
    } else {
      lines.push(`${indent}  // TODO: Implement with ${fn.name}`);
    }
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

function getSdkHint(adapterName: string, functionName: string): string | null {
  const hints: Record<string, Record<string, string>> = {
    stripe: {
      initiatePayment: "stripe.paymentIntents.create({ amount, currency, payment_method })",
      refundPayment: "stripe.refunds.create({ payment_intent, amount })",
      getPaymentStatus: "stripe.paymentIntents.retrieve(paymentId)",
      createSubscription: "stripe.subscriptions.create({ customer, items: [{ price }] })",
      getSubscription: "stripe.subscriptions.retrieve(subscriptionId)",
      cancelSubscription: "stripe.subscriptions.cancel(subscriptionId)",
    },
    redis: {
      get: "redis.get(key)",
      set: "redis.set(key, value, { EX: ttl })",
      delete: "redis.del(key)",
      exists: "redis.exists(key)",
      expire: "redis.expire(key, seconds)",
      ttl: "redis.ttl(key)",
    },
    bullmq: {
      enqueue: "queue.add(name, data, { attempts: 3 })",
      dequeue: "worker.process(job => handler(job.data))",
      peek: "queue.getJobs(['waiting'], 0, 1)",
      size: "queue.getWaitingCount()",
      remove: "queue.remove(jobId)",
    },
    sendgrid: {
      sendEmail: "sgMail.send({ to, from, subject, text })",
    },
    resend: {
      sendEmail: "resend.emails.send({ from, to, subject, html })",
    },
    twilio: {
      sendSMS: "twilio.messages.create({ to, from, body })",
    },
  };

  return hints[adapterName]?.[functionName] ?? null;
}
