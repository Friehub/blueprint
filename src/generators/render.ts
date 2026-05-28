import type { TemplateData } from "./types.js";

export type Template = {
  name: string;
  content: string;
};

export type RenderContext = {
  data: TemplateData;
  [key: string]: unknown;
};

export function renderTemplate(template: string, context: RenderContext): string {
  let result = template;

  result = result.replace(/\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, key, block) => {
    const items = context[key];
    if (!Array.isArray(items)) return "";
    return items.map((item: unknown) => renderBlock(block, item, context)).join("");
  });

  result = result.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, block) => {
    return context[key] ? block : "";
  });

  result = result.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
    const value = resolvePath(context, path);
    return value !== undefined && value !== null ? String(value) : "";
  });

  result = result.replace(/\{\{pascalCase (\w+)\}\}/g, (_, key) => {
    const value = context[key];
    if (typeof value !== "string") return "";
    return context.data.pascalCase(value);
  });

  result = result.replace(/\{\{camelCase (\w+)\}\}/g, (_, key) => {
    const value = context[key];
    if (typeof value !== "string") return "";
    return context.data.camelCase(value);
  });

  result = result.replace(/\{\{snakeCase (\w+)\}\}/g, (_, key) => {
    const value = context[key];
    if (typeof value !== "string") return "";
    return context.data.snakeCase(value);
  });

  return result;
}

function renderBlock(block: string, item: unknown, context: RenderContext): string {
  if (typeof item !== "object" || item === null) {
    return block.replace(/\{\{this\}\}/g, String(item));
  }

  let result = block;
  const obj = item as Record<string, unknown>;

  for (const [key, value] of Object.entries(obj)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(regex, value !== undefined && value !== null ? String(value) : "");
  }

  result = result.replace(/\{\{pascalCase (\w+)\}\}/g, (_, key) => {
    const value = obj[key];
    if (typeof value !== "string") return "";
    return context.data.pascalCase(value);
  });

  result = result.replace(/\{\{camelCase (\w+)\}\}/g, (_, key) => {
    const value = obj[key];
    if (typeof value !== "string") return "";
    return context.data.camelCase(value);
  });

  result = result.replace(/\{\{snakeCase (\w+)\}\}/g, (_, key) => {
    const value = obj[key];
    if (typeof value !== "string") return "";
    return context.data.snakeCase(value);
  });

  return result;
}

function resolvePath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
