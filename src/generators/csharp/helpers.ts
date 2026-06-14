import type { ContractFunction, ContractType, ModuleContract } from "../../core/catalog.js";
import type { AdapterDefinition } from "../../core/adapters/types.js";
import { pascalCase, camelCase, snakeCase, mapType, inferType } from "../types.js";

export function csharpType(type: string): string {
  const map: Record<string, string> = {
    string: "string",
    number: "long",
    boolean: "bool",
    Timestamp: "DateTime",
    "Record<string, unknown>": "Dictionary<string, object>",
  };
  return map[type] ?? type;
}

export function interfaceName(name: string): string {
  return `I${pascalCase(name)}Contract`;
}

export function className(name: string, provider: string): string {
  return `${pascalCase(provider)}${pascalCase(name)}Adapter`;
}

export function methodName(name: string): string {
  return `${pascalCase(name)}Async`;
}

export function namespaceName(module: string): string {
  return `Blueprint.${pascalCase(module)}`;
}

export function generateTypeDefinition(type: ContractType): string {
  const name = pascalCase(type.name);
  const raw = type.raw;

  if (raw.startsWith("type ") || raw.includes(" = ")) {
    const match = raw.match(/(\w+)\s*=\s*(.+)/);
    if (match) {
      const variants = match[2]!.split("|").map((v) => v.trim().replace(/^['"]|['"]$/g, ""));
      const consts = variants.map((v) => `    ${pascalCase(v)}`).join(",\n");
      return `public enum ${name}\n{\n${consts}\n}`;
    }
    return `// ${name}: ${raw}`;
  }

  if (raw.includes("{")) {
    const fields = parseTypeFields(raw);
    if (fields.length === 0) {
      const simple = raw.match(/^\w+\s*\{\s*(.+)\s*\}$/);
      if (simple) {
        const fieldNames = simple[1]!.split(",").map((f) => f.trim().replace(/\?$/, ""));
        const fieldsStr = fieldNames.map((f) => {
          const t = csharpType(inferType(f, "csharp"));
          return `    public ${t} ${pascalCase(f)} { get; init; }`;
        }).join("\n");
        return `public record ${name}\n{\n${fieldsStr}\n}`;
      }
      return `// ${name}: ${raw}`;
    }
    const fieldsStr = fields.map((f) => {
      const t = f.type ? csharpType(mapType(f.type, "csharp")) : csharpType(inferType(f.name, "csharp"));
      const nullable = f.optional ? "?" : "";
      return `    public ${t}${nullable} ${pascalCase(f.name)} { get; init; }`;
    }).join("\n");
    return `public record ${name}\n{\n${fieldsStr}\n}`;
  }

  return `// ${name}: ${raw}`;
}

export function generateCsharpInterface(
  module: { name: string; functions: ContractFunction[]; types: ContractType[] },
  resolveFnName: (name: string) => string,
  resolveModName: (name: string) => string,
): string {
  const ns = namespaceName(resolveModName(module.name));
  const ifaceName = interfaceName(resolveModName(module.name));
  const lines: string[] = [
    `// ${ifaceName}.cs`,
    `// Do not edit directly. Generated code.`,
    "",
    "using System;",
    "using System.Collections.Generic;",
    "using System.Threading;",
    "using System.Threading.Tasks;",
    "",
    `namespace ${ns}`,
    "{",
  ];

  for (const type of module.types) {
    const defn = generateTypeDefinition(type);
    for (const line of defn.split("\n")) {
      lines.push(`    ${line}`);
    }
    lines.push("");
  }

  lines.push(`    public interface ${ifaceName}`);
  lines.push("    {");

  for (const fn of module.functions) {
    const aliasedFn = { ...fn, name: resolveFnName(fn.name) };
    const ret = mapType(aliasedFn.returns, "csharp");
    const params = aliasedFn.params.map((p) => {
      const t = p.type ? mapType(p.type, "csharp") : inferType(p.name, "csharp");
      const nullable = p.optional ? "?" : "";
      const def = p.optional ? " = default" : "";
      return `${t}${nullable} ${camelCase(p.name)}${def}`;
    });
    params.push("CancellationToken cancellationToken = default");
    lines.push(`        Task<${ret}> ${methodName(aliasedFn.name)}(${params.join(", ")});`);
  }

  lines.push("    }");
  lines.push("}");
  return lines.join("\n");
}

export function generateCsharpClass(
  module: { name: string; functions: ContractFunction[] },
  adapter: AdapterDefinition,
  resolveFnName: (name: string) => string,
  resolveClsName: (name: string, provider: string) => string,
): string {
  const ifaceName = interfaceName(pascalCase(module.name));
  const clsName = resolveClsName(adapter.name, adapter.name);
  const ns = namespaceName(pascalCase(module.name));
  const lines: string[] = [
    `// ${clsName}.cs`,
    `// Do not edit directly. Generated code.`,
    "",
    "using System;",
    "using System.Collections.Generic;",
    "using System.Threading;",
    "using System.Threading.Tasks;",
    "",
    `namespace ${ns}`,
    "{",
    `    public class ${clsName} : ${ifaceName}`,
    "    {",
  ];

  for (const f of adapter.config.required) {
    const t = mapType(f.type, "csharp");
    lines.push(`        private readonly ${t} ${camelCase(f.name)};`);
  }
  lines.push("");

  const configArgs = adapter.config.required.map((f) =>
    `${mapType(f.type, "csharp")} ${camelCase(f.name)}`
  ).join(", ");
  lines.push(`        public ${clsName}(${configArgs})`);
  lines.push("        {");
  for (const f of adapter.config.required) {
    lines.push(`            this.${camelCase(f.name)} = ${camelCase(f.name)};`);
  }
  lines.push("        }");
  lines.push("");

  for (const fn of module.functions) {
    const aliasedFn = { ...fn, name: resolveFnName(fn.name) };
    if (adapter.implements.includes(fn.name)) {
      lines.push(generateImplementedMethod(aliasedFn, module.name, adapter.name));
    } else {
      const msg = adapter.does_not_implement?.includes(fn.name)
        ? `Not supported by ${adapter.name}`
        : `Not yet implemented`;
      lines.push(generateNotImplementedMethod(aliasedFn, msg));
    }
  }

  lines.push("    }");
  lines.push("}");
  return lines.join("\n");
}

function generateImplementedMethod(fn: ContractFunction, moduleName: string, provider: string): string {
  const ret = mapType(fn.returns, "csharp");
  const params = fn.params.map((p) => {
    const t = p.type ? mapType(p.type, "csharp") : inferType(p.name, "csharp");
    const nullable = p.optional ? "?" : "";
    const def = p.optional ? " = default" : "";
    return `${t}${nullable} ${camelCase(p.name)}${def}`;
  });
  params.push("CancellationToken cancellationToken = default");
  return `        public async Task<${ret}> ${methodName(fn.name)}(${params.join(", ")})\n        {\n            // TODO: Implement ${fn.name}\n            throw new NotImplementedException();\n        }\n`;
}

function generateNotImplementedMethod(fn: ContractFunction, message: string): string {
  const ret = mapType(fn.returns, "csharp");
  const params = fn.params.map((p) => {
    const t = p.type ? mapType(p.type, "csharp") : inferType(p.name, "csharp");
    const nullable = p.optional ? "?" : "";
    const def = p.optional ? " = default" : "";
    return `${t}${nullable} ${camelCase(p.name)}${def}`;
  });
  params.push("CancellationToken cancellationToken = default");
  return `        public async Task<${ret}> ${methodName(fn.name)}(${params.join(", ")})\n        {\n            throw new NotImplementedException("${message}");\n        }\n`;
}

export function generateCsharpTest(
  module: { name: string; functions: ContractFunction[] },
  adapter: AdapterDefinition,
  resolveFnName: (name: string) => string,
): string {
  const ifaceName = interfaceName(pascalCase(module.name));
  const clsName = `${pascalCase(adapter.name)}${pascalCase(module.name)}Adapter`;
  const lines: string[] = [
    `// ${clsName}Tests.cs`,
    `// Do not edit directly. Generated code.`,
    "",
    "using Xunit;",
    "",
    `namespace ${namespaceName(module.name)}.Tests`,
    "{",
    `    public class ${clsName}Tests`,
    "    {",
  ];

  const testConfigArgs = adapter.config.required.map(() => `"test"`).join(", ");
  lines.push(`        private readonly ${ifaceName} _adapter = new ${clsName}(${testConfigArgs});`);
  lines.push("");
  lines.push("        [Fact]");
  lines.push("        public void ImplementsContract()");
  lines.push("        {");
  lines.push(`            Assert.IsAssignableFrom<${ifaceName}>(_adapter);`);
  lines.push("        }");
  lines.push("");

  for (const fn of module.functions) {
    const aliasedName = resolveFnName(fn.name);
    lines.push("        [Fact]");
    lines.push(`        public async Task ${pascalCase(aliasedName)}_Returns_NotNull()`);
    lines.push("        {");
    const paramDefaults = fn.params.map((p) => {
      if (p.type === "number" || p.type === "boolean") return p.type === "number" ? "0" : "false";
      return "string" === "string" ? `"test"` : "default";
    }).join(", ");
    lines.push(`            var result = await _adapter.${methodName(aliasedName)}(${paramDefaults});`);
    if (fn.returns === "void") {
      lines.push("            // void method completed");
    } else {
      lines.push("            Assert.NotNull(result);");
    }
    lines.push("        }");
    lines.push("");
  }

  lines.push("    }");
  lines.push("}");
  return lines.join("\n");
}

export function generateRecord(type: ContractType): string {
  return generateTypeDefinition(type);
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


