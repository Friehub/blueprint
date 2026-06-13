import type { ContractFunction, ContractType, ModuleContract } from "../../core/catalog.js";
import { pascalCase, camelCase, snakeCase, mapType, inferType } from "../types.js";

export function generateTypeDefinition(type: ContractType, useRecords?: boolean): string {
  const name = pascalCase(type.name);
  const raw = type.raw;

  if (raw.startsWith("type ") || raw.includes(" = ")) {
    const match = raw.match(/(\w+)\s*=\s*(.+)/);
    if (match) {
      const variants = match[2]!.split("|").map((v) => v.trim().replace(/^['"]|['"]$/g, ""));
      const consts = variants.map((v) => `    ${v.toUpperCase()}`).join(",\n");
      return `public enum ${name} {\n${consts}\n}`;
    }
    return `// ${name}: ${raw}`;
  }

  if (raw.includes("{")) {
    const fields = parseTypeFields(raw);
    if (fields.length === 0) {
      const simple = raw.match(/^\w+\s*\{\s*(.+)\s*\}$/);
      if (simple) {
        const fieldNames = simple[1]!.split(",").map((f) => f.trim().replace(/\?$/, ""));
        if (useRecords) {
          const fieldsStr = fieldNames.map((f) => {
            const javaType = inferType(f, "java");
            return `    ${camelCase(f)} ${javaType}`;
          }).join(",\n");
          return `public record ${name}(\n${fieldsStr}\n) {}`;
        }
        const fieldsStr = fieldNames.map((f) => {
          const javaType = inferType(f, "java");
          return `    private ${javaType} ${camelCase(f)};`;
        }).join("\n");
        return `public class ${name} {\n${fieldsStr}\n}`;
      }
      return `// ${name}: ${raw}`;
    }
    if (useRecords) {
      const fieldsStr = fields.map((f) => {
        const t = f.type ? mapType(f.type, "java") : inferType(f.name, "java");
        return `    ${f.optional ? `Optional<${t}>` : t} ${camelCase(f.name)}`;
      }).join(",\n");
      return `public record ${name}(\n${fieldsStr}\n) {}`;
    }
    const fieldsStr = fields.map((f) => {
      const t = f.type ? mapType(f.type, "java") : inferType(f.name, "java");
      return `    private ${f.optional ? `Optional<${t}>` : t} ${camelCase(f.name)};`;
    }).join("\n");
    return `public class ${name} {\n${fieldsStr}\n}`;
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
    const type = p.type ? mapType(p.type, "java") : inferType(p.name, "java");
    return `${type} ${camelCase(p.name)}`;
  }).join(", ");
  const returnType = mapType(fn.returns, "java");
  return `    ${returnType} ${camelCase(fn.name)}(${params});`;
}

export function generateParamsList(fn: ContractFunction): string {
  return fn.params.map((p) => {
    const type = p.type ? mapType(p.type, "java") : inferType(p.name, "java");
    return `${type} ${camelCase(p.name)}`;
  }).join(", ");
}

export function generateSharedTypes(): string {
  return `import java.time.Instant;
import java.util.List;
import java.util.Optional;

public class PaginatedResult<T> {
    private List<T> data;
    private Optional<String> cursor;
    private boolean hasMore;
    private Optional<Long> total;
}
`;
}

export function generatePackageDeclaration(moduleName: string): string {
  return `package blueprint.${moduleName};`;
}


