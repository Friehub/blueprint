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
    "// Generated module index",
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
