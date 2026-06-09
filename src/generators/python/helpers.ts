import type { ContractFunction, ContractType } from "../../core/catalog.js";
import { pascalCase, snakeCase, mapType, inferType } from "../types.js";

export function generateTypeDefinition(type: ContractType): string {
  const name = pascalCase(type.name);
  const raw = type.raw;

  if (raw.startsWith("type ") || raw.includes(" = ")) {
    const match = raw.match(/(\w+)\s*=\s*(.+)/);
    if (match) {
      const variants = match[2]!.split("|").map((v) => v.trim());
      const values = variants.map((v) => v.replace(/^['"]|['"]$/g, "")).join('", "');
      return `${name} = Literal["${values}"]`;
    }
    return `# ${name}: ${raw}`;
  }

  if (raw.includes("{")) {
    const fields = parseTypeFields(raw);
    if (fields.length === 0) {
      const simple = raw.match(/^\w+\s*\{\s*(.+)\s*\}$/);
      if (simple) {
        const fieldNames = simple[1]!.split(",").map((f) => f.trim().replace(/\?$/, ""));
        const fieldsStr = fieldNames.map((f) => {
          return `    ${snakeCase(f)}: ${inferType(f, "python")}`;
        }).join("\n");
        return `@dataclass\nclass ${name}:\n${fieldsStr}`;
      }
      return `# ${name}: ${raw}`;
    }
    const fieldsStr = fields.map((f) => {
      const t = f.type ? mapType(f.type, "python") : inferType(f.name, "python");
      return `    ${snakeCase(f.name)}${f.optional ? ": Optional[" + t + "]" : ": " + t}`;
    }).join("\n");
    return `@dataclass\nclass ${name}:\n${fieldsStr}`;
  }

  return `# ${name}: ${raw}`;
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
    const type = p.type ? mapType(p.type, "python") : inferType(p.name, "python");
    const defaultVal = p.optional ? " = None" : "";
    return `${snakeCase(p.name)}: ${p.optional ? `Optional[${type}]` : type}${defaultVal}`;
  }).join(", ");
  const returnType = mapType(fn.returns, "python");
  const args = params ? `self, ${params}` : "self";
  return `    async def ${snakeCase(fn.name)}(${args}) -> ${returnType}: ...`;
}

export function generateParamsList(fn: ContractFunction): string {
  const params = fn.params.map((p) => {
    const type = p.type ? mapType(p.type, "python") : inferType(p.name, "python");
    const defaultVal = p.optional ? " = None" : "";
    return `${snakeCase(p.name)}: ${p.optional ? `Optional[${type}]` : type}${defaultVal}`;
  }).join(", ");
  return params;
}

export function generateErrorHierarchy(moduleName: string): string {
  const className = `${pascalCase(moduleName)}Error`;
  return [
    `class ${className}(Exception): pass`,
  ].join("\n");
}

export function generateSharedTypes(): string {
  return `from typing import Optional, Any
from dataclasses import dataclass
from datetime import datetime

Timestamp = str
UserId = str
EntityId = str

@dataclass
class PaginatedResult[T]:
    data: list[T]
    cursor: Optional[str]
    hasMore: bool
    total: Optional[int] = None
`;
}

export function generateIndex(moduleNames: string[]): string {
  const lines: string[] = [
    "# Auto-generated module index",
    "",
    "from .shared import *",
    "",
  ];
  for (const name of moduleNames.sort()) {
    lines.push(`from .${name} import *`);
  }
  return lines.join("\n");
}
