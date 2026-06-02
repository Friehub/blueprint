import type { ContractFunction, ContractType } from "../../core/catalog.js";
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
    const type = p.type ? `: ${mapType(p.type, "typescript")}` : ": unknown";
    return `${camelCase(p.name)}${p.optional ? "?" : ""}${type}`;
  }).join(", ");
  return `  ${camelCase(fn.name)}(${params}): Promise<${mapType(fn.returns, "typescript")}>;`;
}

export function generateParamsList(fn: ContractFunction): string {
  return fn.params.map((p) => {
    const type = p.type ? `: ${mapType(p.type, "typescript")}` : ": unknown";
    return `${camelCase(p.name)}${p.optional ? "?" : ""}${type}`;
  }).join(", ");
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
`;

export function generateSharedTypes(): string {
  return SHARED_TYPES;
}

export function generateIndex(moduleNames: string[]): string {
  const lines: string[] = [
    "// Auto-generated module index",
    "",
    "export * from './shared.js';",
    "",
  ];
  for (const name of moduleNames.sort()) {
    lines.push(`export * from './${name}.js';`);
  }
  return lines.join("\n");
}

export function getSdkHint(adapterName: string, functionName: string): string | null {
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
    sendgrid: { sendEmail: "sgMail.send({ to, from, subject, text })" },
    resend: { sendEmail: "resend.emails.send({ from, to, subject, html })" },
    twilio: { sendSMS: "twilio.messages.create({ to, from, body })" },
  };
  return hints[adapterName]?.[functionName] ?? null;
}
