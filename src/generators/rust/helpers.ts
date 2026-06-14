import type { ContractFunction, ContractType } from "../../core/catalog.js";
import { pascalCase, snakeCase, mapType, inferType } from "../types.js";

export function generateTypeDefinition(type: ContractType): string {
  const name = pascalCase(type.name);
  const raw = type.raw;

  if (raw.startsWith("type ") || raw.includes(" = ")) {
    const match = raw.match(/(\w+)\s*=\s*(.+)/);
    if (match) {
      const variants = match[2]!.split("|").map((v) => v.trim().replace(/^['"]|['"]$/g, ""));
      const consts = variants.map((v) => {
        const constName = name + pascalCase(v);
        return `    ${constName},`;
      }).join("\n");
      return `#[derive(Debug, Clone, PartialEq)]\npub enum ${name} {\n${consts}\n}`;
    }
    return `pub type ${name} = ${raw};`;
  }

  if (raw.includes("{")) {
    const fields = parseTypeFields(raw);
    if (fields.length === 0) {
      const simple = raw.match(/^\w+\s*\{\s*(.+)\s*\}$/);
      if (simple) {
        const fieldNames = simple[1]!.split(",").map((f) => f.trim().replace(/\?$/, ""));
        const fieldsStr = fieldNames.map((f) => {
          const rustType = inferType(f, "rust");
          return `    pub ${snakeCase(f)}: ${rustType},`;
        }).join("\n");
        return `#[derive(Debug, Clone)]\npub struct ${name} {\n${fieldsStr}\n}`;
      }
      return `// ${name}: ${raw}`;
    }
    const fieldsStr = fields.map((f) => {
      const t = f.type ? mapType(f.type, "rust") : inferType(f.name, "rust");
      return `    pub ${snakeCase(f.name)}: ${f.optional ? `Option<${t}>` : t},`;
    }).join("\n");
    return `#[derive(Debug, Clone)]\npub struct ${name} {\n${fieldsStr}\n}`;
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
    const type = p.type ? mapType(p.type, "rust") : inferType(p.name, "rust");
    return `        ${snakeCase(p.name)}: ${p.optional ? `Option<${type}>` : type},`;
  }).join("\n");
  const returnType = mapType(fn.returns, "rust");
  const hasAsync = fn.params.some((p) => true);
  if (params) {
    return `    async fn ${snakeCase(fn.name)}(\n        &self,\n${params}\n    ) -> ${returnType};`;
  }
  return `    async fn ${snakeCase(fn.name)}(&self) -> ${returnType};`;
}

export function generateParamsList(fn: ContractFunction): string {
  return fn.params.map((p) => {
    const type = p.type ? mapType(p.type, "rust") : inferType(p.name, "rust");
    return `${snakeCase(p.name)}: ${p.optional ? `Option<${type}>` : type}`;
  }).join(", ");
}

export function generateErrorEnum(moduleName: string): string {
  const name = pascalCase(moduleName);
  return `#[derive(Debug, thiserror::Error)]\npub enum ${name}Error {\n    #[error("${moduleName} operation failed")]\n    OperationFailed(String),\n}`;
}

export function generateSharedTypes(): string {
  return `use std::collections::HashMap;
use serde::{Deserialize, Serialize};

pub type Timestamp = String;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResult<T> {
    pub data: Vec<T>,
    pub cursor: Option<String>,
    pub has_more: bool,
    pub total: Option<i64>,
}
`;
}
