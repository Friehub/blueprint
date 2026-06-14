import type { ContractFunction, ContractType } from "../../core/catalog.js";
import { pascalCase, camelCase, mapType, inferType } from "../types.js";

export function generateTypeDefinition(type: ContractType): string {
  const name = pascalCase(type.name);
  const raw = type.raw;

  if (raw.startsWith("type ") || raw.includes(" = ")) {
    const match = raw.match(/(\w+)\s*=\s*(.+)/);
    if (match) {
      const variants = match[2]!.split("|").map((v) => v.trim().replace(/^['"]|['"]$/g, ""));
      const consts = variants.map((v) => {
        const constName = name + pascalCase(v);
        return `\t${constName} ${name} = "${v}"`;
      }).join("\n");
      return `type ${name} string\n\nconst (\n${consts}\n)`;
    }
    return `type ${name} ${raw}`;
  }

  if (raw.includes("{")) {
    const fields = parseTypeFields(raw);
    if (fields.length === 0) {
      const simple = raw.match(/^\w+\s*\{\s*(.+)\s*\}$/);
      if (simple) {
        const fieldNames = simple[1]!.split(",").map((f) => f.trim().replace(/\?$/, ""));
        const fieldsStr = fieldNames.map((f) => {
          const goType = inferType(f, "go");
          const jsonTag = `\`json:"${camelCase(f)}"\``;
          return `\t${pascalCase(f)} ${goType} ${jsonTag}`;
        }).join("\n");
        return `type ${name} struct {\n${fieldsStr}\n}`;
      }
      return `// ${name}: ${raw}`;
    }
    const fieldsStr = fields.map((f) => {
      const t = f.type ? mapType(f.type, "go") : inferType(f.name, "go");
      const goName = pascalCase(f.name);
      const jsonTag = `\`json:"${camelCase(f.name)}"\``;
      if (f.optional) {
        return `\t${goName} *${t} ${jsonTag}`;
      }
      return `\t${goName} ${t} ${jsonTag}`;
    }).join("\n");
    return `type ${name} struct {\n${fieldsStr}\n}`;
  }

  return `// ${name}: ${raw}`;
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
    const type = p.type ? mapType(p.type, "go") : inferType(p.name, "go");
    if (p.optional) return `${camelCase(p.name)} *${type}`;
    return `${camelCase(p.name)} ${type}`;
  }).join(", ");
  const returnType = mapType(fn.returns, "go");
  const returnStr = fn.returns === "void" || fn.returns === "None" ? "error" : `(${returnType}, error)`;
  return `\t${camelCase(fn.name)}(${params}) ${returnStr}`;
}

export function generateParamsList(fn: ContractFunction): string {
  return fn.params.map((p) => {
    const type = p.type ? mapType(p.type, "go") : inferType(p.name, "go");
    if (p.optional) return `${camelCase(p.name)} *${type}`;
    return `${camelCase(p.name)} ${type}`;
  }).join(", ");
}

export function generateSharedTypes(): string {
  return `package blueprint

import "time"

type Timestamp = time.Time

type PaginatedResult[T any] struct {
\tData    []T    \`json:"data"\`
\tCursor  *string \`json:"cursor"\`
\tHasMore bool   \`json:"has_more"\`
\tTotal   *int64 \`json:"total,omitempty"\`
}
`;
}

export function generateErrorSentinel(moduleName: string): string {
  return `var Err${pascalCase(moduleName)} = errors.New("${moduleName}_error")`;
}
