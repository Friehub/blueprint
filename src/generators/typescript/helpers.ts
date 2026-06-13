import type { ContractFunction, ContractType, ModuleContract } from "../../core/catalog.js";
import { pascalCase, camelCase, mapType, inferType } from "../types.js";

export function generateTypeDefinition(type: ContractType): string {
  const name = pascalCase(type.name);
  const raw = type.raw;

  if (raw.startsWith("type ")) {
    return `export ${raw}`;
  }

  if (raw.includes("{")) {
    const fields = parseTypeFields(raw);
    const fieldsStr = fields.map((f) => {
      const type = f.type ? `: ${mapType(f.type, "typescript")}` : `: ${inferType(f.name, "typescript")}`;
      return `  ${camelCase(f.name)}${f.optional ? "?" : ""}${type};`;
    }).join("\n");
    return `export interface ${name} {\n${fieldsStr}\n}`;
  }

  const fieldsMatch = raw.match(/^\w+\s*\{\s*(.+)\s*\}$/);
  if (fieldsMatch) {
    const fields = fieldsMatch[1]!.split(",").map((f) => f.trim());
    const fieldsStr = fields.map((f) => {
      const optional = f.endsWith("?");
      const fieldName = f.replace(/\?$/, "");
      return `  ${camelCase(fieldName)}${optional ? "?" : ""}: ${inferType(fieldName, "typescript")};`;
    }).join("\n");
    return `export interface ${name} {\n${fieldsStr}\n}`;
  }

  return `export type ${name} = ${raw};`;
}

function parseTypeFields(raw: string): Array<{ name: string; type: string | null; optional: boolean }> {
  const fields: Array<{ name: string; type: string | null; optional: boolean }> = [];
  const match = raw.match(/\{([^}]+)\}/s);
  if (!match) return fields;

  const content = match[1] ?? "";
  for (const line of content.split(/[,\n]/).filter((l) => l.trim())) {
    const trimmed = line.trim().replace(/,\s*$/, "").replace(/\/\/.*$/, "").trim();
    if (!trimmed) continue;

    const typeMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/);
    if (typeMatch) {
      fields.push({ name: typeMatch[1] ?? "", type: typeMatch[2]?.trim() ?? null, optional: false });
      continue;
    }
    const optionalMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\?\s*:\s*(.+)$/);
    if (optionalMatch) {
      fields.push({ name: optionalMatch[1] ?? "", type: optionalMatch[2]?.trim() ?? null, optional: true });
      continue;
    }
    const simpleMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)$/);
    if (simpleMatch) {
      fields.push({ name: simpleMatch[1] ?? "", type: null, optional: trimmed.endsWith("?") });
    }
  }
  return fields;
}

export function generateFunctionSignature(fn: ContractFunction): string {
  const params = fn.params.map((p) => {
    const type = p.type ? `: ${mapType(p.type, "typescript")}` : `: ${inferType(p.name, "typescript")}`;
    return `${camelCase(p.name)}${p.optional ? "?" : ""}${type}`;
  }).join(", ");
  return `  ${camelCase(fn.name)}(${params}): Promise<${mapType(fn.returns, "typescript")}>;`;
}

export function generateParamsList(fn: ContractFunction): string {
  return fn.params.map((p) => {
    const type = p.type ? `: ${mapType(p.type, "typescript")}` : `: ${inferType(p.name, "typescript")}`;
    return `${camelCase(p.name)}${p.optional ? "?" : ""}${type}`;
  }).join(", ");
}

export function generateZodSchema(type: ContractType): string {
  const name = pascalCase(type.name);
  const raw = type.raw;

  if (raw.startsWith("type ")) {
    const eqIdx = raw.indexOf("=");
    const valuesRaw = eqIdx !== -1 ? raw.slice(eqIdx + 1).trim() : "";
    const values = valuesRaw.split("|").map((s) => s.trim().replace(/^`|`$/g, "").replace(/^"|"$/g, "")).filter(Boolean);
    if (values.length > 0 && values.every((v) => /^[a-zA-Z_]/.test(v))) {
      return `export const ${name}Schema = z.enum([${values.map((v) => `"${v}"`).join(", ")}]);`;
    }
    if (values.length > 0 && values.every((v) => /^'/.test(v) || /^"/.test(v))) {
      return `export const ${name}Schema = z.enum([${values.join(", ")}]);`;
    }
    return `export const ${name}Schema = z.any();`;
  }

  if (raw.includes("{")) {
    const fields = parseTypeFields(raw);
    const fieldsStr = fields.map((f) => {
      const zodType = mapToZodType(f.type);
      return `  ${camelCase(f.name)}${f.optional ? "?" : ""}: ${zodType},`;
    }).join("\n");
    return `export const ${name}Schema = z.object({\n${fieldsStr}\n});`;
  }

  return `export const ${name}Schema = z.any();`;
}

function mapToZodType(type: string | null): string {
  if (!type) return "z.any()";
  const isArray = type.endsWith("[]");
  const isOptional = type.endsWith("?");
  const base = type.replace(/\[\]$/, "").replace(/\?$/, "");

  let zodType: string;
  switch (base) {
    case "string": zodType = "z.string()"; break;
    case "number": zodType = "z.number()"; break;
    case "boolean": zodType = "z.boolean()"; break;
    case "Timestamp": zodType = "z.string()"; break;
    default:
      zodType = /^[A-Z]/.test(base) ? `${base}Schema` : "z.any()";
  }

  if (isArray) zodType = `z.array(${zodType})`;
  if (isOptional) zodType = `${zodType}.optional()`;
  return zodType;
}

export function parseEventEmissionContent(content: string): string[] {
  const events: string[] = [];
  const fenceRegex = /```[\s\S]*?```/g;
  const fences = content.match(fenceRegex);
  if (!fences) return events;

  for (const fence of fences) {
    const inner = fence.replace(/```\w*\n?/, "").replace(/\n?```$/, "");
    const lines = inner.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("OR") || trimmed.startsWith("//") || trimmed.startsWith("All events")) continue;
      const match = trimmed.match(/^(\w+)\s*[→➡]\s*(\S+)\s+\{(.+)\}$/);
      if (match) {
        const eventName = match[2]!.trim();
        const payload = match[3]!.trim();
        events.push(`${eventName}: { ${payload} }`);
      }
    }
  }
  return [...new Set(events)];
}

export function generateEventTypes(mod: ModuleContract): string {
  const modName = pascalCase(mod.name);
  const lines: string[] = [
    `// ${modName} Event Types`,
    `// Generated from contract Event Emission section`,
    "",
  ];

  const uniqueEventMap = new Map<string, string>();
  for (const section of mod.rawSections) {
    const content = section.content || "";
    if (section.name.toLowerCase().includes("events emitted") || content.includes("### Event Emission")) {
      const events = parseEventEmissionContent(content);
      for (const evt of events) {
        const colonIdx = evt.indexOf(":");
        if (colonIdx !== -1) {
          const name = evt.slice(0, colonIdx).trim();
          const payload = evt.slice(colonIdx + 1).trim();
          uniqueEventMap.set(name, payload);
        }
      }
    }
  }

  if (uniqueEventMap.size === 0) {
    return `// No events emitted by ${modName}\n`;
  }

  for (const [eventName, payload] of uniqueEventMap) {
    const interfaceName = pascalCase(eventName.replace(/\./g, "_")) + "Event";
    const fields = payload.replace(/[{}]/g, "").split(",").map((f) => f.trim()).filter(Boolean);
    lines.push(`export interface ${interfaceName} {`);
    for (const field of fields) {
      const parts = field.split(/:|\s+/).filter(Boolean);
      if (parts.length === 1) {
        lines.push(`  ${camelCase(parts[0]!)}: string;`);
      } else if (parts.length >= 2) {
        const name = parts[0]!;
        const optional = name.endsWith("?");
        const cleanName = name.replace(/\?$/, "");
        const typeStr = parts.slice(1).join(" ");
        const tsType = mapType(typeStr, "typescript");
        lines.push(`  ${camelCase(cleanName)}${optional ? "?" : ""}: ${tsType};`);
      }
    }
    lines.push("}");
    lines.push("");
  }

  lines.push(`export type ${modName}Event =`);
  let idx = 0;
  for (const eventName of uniqueEventMap.keys()) {
    const interfaceName = pascalCase(eventName.replace(/\./g, "_")) + "Event";
    lines.push(`  ${idx === 0 ? "" : "| "}${interfaceName}`);
    idx++;
  }
  lines.push("");

  lines.push(`export interface ${modName}EventEmitter {`);
  for (const eventName of uniqueEventMap.keys()) {
    const interfaceName = pascalCase(eventName.replace(/\./g, "_")) + "Event";
    lines.push(`  emit(eventName: '${eventName}', payload: ${interfaceName}): void;`);
  }
  lines.push("}");

  return lines.join("\n");
}

export function parseErrorTaxonomyContent(mod: ModuleContract): Array<{ functionName: string; errorCode: string; description: string }> {
  const errors: Array<{ functionName: string; errorCode: string; description: string }> = [];
  for (const section of mod.rawSections) {
    const content = section.content || "";
    if (!content.includes("### Error Taxonomy") && !section.name.toLowerCase().includes("error taxonomy")) continue;

    const fenceRegex = /```[\s\S]*?```/g;
    const fences = content.match(fenceRegex);
    if (!fences) continue;

    let currentFn = "";
    for (const fence of fences) {
      const inner = fence.replace(/```\w*\n?/, "").replace(/\n?```$/, "");
      const lines = inner.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const fnMatch = trimmed.match(/^(\w+):$/);
        if (fnMatch) {
          currentFn = fnMatch[1]!;
          continue;
        }
        const codeMatch = trimmed.match(/^\s{2,4}(\w+):\s+(.+?)\s*\|/);
        if (codeMatch && currentFn) {
          errors.push({
            functionName: currentFn,
            errorCode: codeMatch[1]!.trim(),
            description: codeMatch[2]!.trim(),
          });
        }
      }
    }
  }
  return errors;
}

export function generateTranslateMethod(adapterName: string, mod: ModuleContract): string {
  const errors = parseErrorTaxonomyContent(mod);

  if (errors.length === 0) {
    return [
      `  /**`,
      `   * Translate SDK error to contract error code.`,
      `   * @param error - The original error from the SDK`,
      `   * @throws The translated error`,
      `   */`,
      `  private translateError(error: unknown): never {`,
      `    throw error instanceof Error ? error : new Error(String(error));`,
      `  }`,
    ].join("\n");
  }

  const lines: string[] = [
    `  /**`,
    `   * Translate SDK error to contract error code.`,
    `   * @param error - The original error from the SDK`,
    `   * @param functionName - Optional function name for context-specific error mapping`,
    `   * @throws Translated ContractError`,
    `   */`,
    `  private translateError(error: unknown, functionName?: string): never {`,
    `    const err = error instanceof Error ? error : new Error(String(error));`,
    `    const message = err.message.toLowerCase();`,
    `    const code = (err as any).code || (err as any).statusCode || '';`,
    ``,
    `    // Map known SDK error patterns to contract error codes`,
  ];

  const codeToFns = new Map<string, string[]>();
  for (const e of errors) {
    if (!codeToFns.has(e.errorCode)) codeToFns.set(e.errorCode, []);
    codeToFns.get(e.errorCode)!.push(e.functionName);
  }

  for (const [code, fns] of codeToFns) {
    const fnCondition = fns.length === 1
      ? `functionName === '${fns[0]}'`
      : `functionName && ['${fns.join("', '")}'].includes(functionName)`;

    lines.push(`    if (${fnCondition} && (message.includes('${code.replace(/_/g, "')")}'))) {`);
    lines.push(`      throw new ContractError('${code}', err);`);
    lines.push(`    }`);
  }

  lines.push(`    throw err;`);
  lines.push(`  }`);

  return lines.join("\n");
}

const SHARED_TYPES = `// Shared types used across all contracts
export type Timestamp = string;
export type UserId = string;
export type EntityId = string;

export interface PaginatedResult<T> {
  data: T[];
  cursor: string | null;
  hasMore: boolean;
  total?: number;
}

// Blueprint contract error class
export class ContractError extends Error {
  public code: string;
  public cause?: unknown;

  constructor(code: string, cause?: unknown) {
    super(\`Contract error: \${code}\`);
    this.name = 'ContractError';
    this.code = code;
    this.cause = cause;
  }
}
`;

export function generateSharedTypes(): string {
  return SHARED_TYPES;
}

export function generateIndex(moduleNames: string[]): string {
  const lines: string[] = [
    "// Generated module index (ESM)",
    "",
    "export * from './shared.js';",
    "",
  ];
  for (const name of moduleNames.sort()) {
    lines.push(`export * from './${name}.js';`);
    lines.push(`export * from './${name}.zod.js';`);
  }
  return lines.join("\n");
}

export function generateIndexCjs(moduleNames: string[]): string {
  const lines: string[] = [
    "// Generated module index (CJS)",
    '"use strict";',
    "var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {",
    "  if (k2 === undefined) k2 = k;",
    "  Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });",
    "}) : (function(o, m, k, k2) {",
    "  if (k2 === undefined) k2 = k;",
    "  o[k2] = m[k];",
    "}));",
    "var __exportStar = (this && this.__exportStar) || function(m, exports) {",
    "  for (var p in m) if (p !== 'default' && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);",
    "};",
    "Object.defineProperty(exports, '__esModule', { value: true });",
    "",
  ];
  lines.push('__exportStar(require("./shared.js"), exports);');
  for (const name of moduleNames.sort()) {
    lines.push(`__exportStar(require('./${name}.js'), exports);`);
    lines.push(`__exportStar(require('./${name}.zod.js'), exports);`);
  }
  return lines.join("\n");
}

export function getSdkHint(adapterName: string, functionName: string): string | null {
  const hints: Record<string, Record<string, string>> = {
    stripe: {
      initiatePayment: "const paymentIntent = await this.stripe.paymentIntents.create({\n  amount: Math.round(amount * 100),\n  currency: currency.toLowerCase(),\n  payment_method: method,\n  metadata: { orderId },\n});\nreturn this.toPayment(paymentIntent);",
      verifyPayment: "const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentId);\nreturn this.toPayment(paymentIntent);",
      getPaymentByOrder: "const paymentIntents = await this.stripe.paymentIntents.list({\n  limit: 1,\n  query: `metadata['orderId']:'${orderId}'`,\n});\nif (paymentIntents.data.length === 0) return undefined;\nreturn this.toPayment(paymentIntents.data[0]);",
      initiateRefund: "const refund = await this.stripe.refunds.create({\n  payment_intent: paymentId,\n  amount: amount ? Math.round(amount * 100) : undefined,\n  reason: reason as any,\n});\nreturn { id: refund.id, paymentId, amount: refund.amount / 100, status: refund.status, reason: reason || '', createdAt: new Date(refund.created * 1000).toISOString() };",
      getRefundByOrder: "const payment = await this.getPaymentByOrder(orderId);\nif (!payment) return undefined;\nreturn this.getRefund(payment.id);",
      getRefund: "const refund = await this.stripe.refunds.retrieve(refundId);\nreturn { id: refund.id, paymentId: refund.payment_intent as string, amount: refund.amount / 100, status: refund.status, reason: refund.reason || '', createdAt: new Date(refund.created * 1000).toISOString() };",
    },
    redis: {
      get: "const result = await this.redis.get(key);\nif (!result) return null;\nreturn JSON.parse(result);",
      set: "const serialized = JSON.stringify(value);\nif (ttl) {\n  await this.redis.set(key, serialized, 'EX', ttl);\n} else {\n  await this.redis.set(key, serialized);\n}",
      delete: "await this.redis.del(key);",
      exists: "const result = await this.redis.exists(key);\nreturn result === 1;",
      expire: "await this.redis.expire(key, seconds);",
      ttl: "return await this.redis.ttl(key);",
    },
    bullmq: {
      enqueue: "return await this.queue.add(name, data, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });",
      dequeue: "const job = await this.queue.getNext();\nif (!job) return null;\nreturn job.data;",
      peek: "const job = await this.queue.getJob(jobId);\nif (!job) return null;\nreturn job.data;",
      size: "return await this.queue.getWaitingCount();",
      remove: "await this.queue.remove(jobId);",
    },
    sendgrid: { sendEmail: "await this.sg.send({ to, from, subject, html: body, text: body });" },
    resend: { sendEmail: "const result = await this.resend.emails.send({ from, to, subject, html: body });\nreturn { messageId: result.id, status: 'sent' };" },
    twilio: { sendSMS: "const message = await this.twilio.messages.create({ to, from, body });\nreturn { messageId: message.sid, status: message.status };" },
  };
  return hints[adapterName]?.[functionName] ?? null;
}
