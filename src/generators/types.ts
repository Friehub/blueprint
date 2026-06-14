import type { Catalog, ModuleContract, CoreContract, ContractFunction, ContractType } from "../core/catalog.js";
import type { AdapterDefinition } from "../core/adapters/types.js";

export type Language = "typescript" | "rust" | "python" | "go" | "java" | "csharp" | "php";

export type GenerationType = "interfaces" | "adapters" | "tests" | "all";

export interface AliasMap {
  functions?: Record<string, string>;
  modules?: Record<string, string>;
  classes?: Record<string, string>;
  config?: Record<string, string>;
  topics?: Record<string, string>;
}

export interface GeneratorContext {
  catalog: Catalog;
  adapters: AdapterDefinition[];
  module: string | undefined;
  provider: string | undefined;
  namespace?: string;
  aliases?: AliasMap;
  obfuscate?: string;
  pythonModels?: "dataclass" | "pydantic";
  javaRecords?: boolean;
  useVirtualThreads?: boolean;
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface GeneratorResult {
  files: GeneratedFile[];
  errors: string[];
}

export interface LanguageGenerator {
  language: Language;
  name: string;

  generateInterfaces(context: GeneratorContext): GeneratorResult;
  generateAdapter(context: GeneratorContext): GeneratorResult;
  generateTests(context: GeneratorContext): GeneratorResult;
  generateRouter?(context: GeneratorContext): GeneratorResult;
}

export interface TemplateData {
  module: string;
  pascalCase: (str: string) => string;
  camelCase: (str: string) => string;
  snakeCase: (str: string) => string;
  kebabCase: (str: string) => string;
  lowerCase: (str: string) => string;
  upperCase: (str: string) => string;
}

export interface TypeMapping {
  contractType: string;
  typescript: string;
  rust: string;
  python: string;
  go: string;
  java: string;
  csharp?: string;
  php?: string;
}

export const TYPE_MAPPINGS: TypeMapping[] = [
  { contractType: "string", typescript: "string", rust: "String", python: "str", go: "string", java: "String", csharp: "string", php: "string" },
  { contractType: "number", typescript: "number", rust: "f64", python: "float", go: "float64", java: "BigDecimal", csharp: "long", php: "int|float" },
  { contractType: "boolean", typescript: "boolean", rust: "bool", python: "bool", go: "bool", java: "boolean", csharp: "bool", php: "bool" },
  { contractType: "null", typescript: "null", rust: "Option::None", python: "None", go: "nil", java: "null", csharp: "null" },
];

export const TYPE_INFERENCE_RULES: Array<{ pattern: RegExp; typescript: string; rust: string; python: string; go: string; java: string; csharp: string }> = [
  { pattern: /^id$/i, typescript: "string", rust: "String", python: "str", go: "string", java: "String", csharp: "string" },
  { pattern: /_id$/i, typescript: "string", rust: "String", python: "str", go: "string", java: "String", csharp: "string" },
  { pattern: /_at$/i, typescript: "Timestamp", rust: "DateTime<Utc>", python: "str", go: "time.Time", java: "Instant", csharp: "DateTime" },
  { pattern: /_count$/i, typescript: "number", rust: "i64", python: "int", go: "int", java: "int", csharp: "int" },
  { pattern: /_amount$/i, typescript: "number", rust: "f64", python: "float", go: "float64", java: "BigDecimal", csharp: "decimal" },
  { pattern: /_price$/i, typescript: "number", rust: "f64", python: "float", go: "float64", java: "BigDecimal", csharp: "decimal" },
  { pattern: /_total$/i, typescript: "number", rust: "f64", python: "float", go: "float64", java: "BigDecimal", csharp: "decimal" },
  { pattern: /is_/i, typescript: "boolean", rust: "bool", python: "bool", go: "bool", java: "boolean", csharp: "bool" },
  { pattern: /has_/i, typescript: "boolean", rust: "bool", python: "bool", go: "bool", java: "boolean", csharp: "bool" },
  { pattern: /_status$/i, typescript: "string", rust: "String", python: "str", go: "string", java: "String", csharp: "string" },
  { pattern: /_type$/i, typescript: "string", rust: "String", python: "str", go: "string", java: "String", csharp: "string" },
  { pattern: /_name$/i, typescript: "string", rust: "String", python: "str", go: "string", java: "String", csharp: "string" },
  { pattern: /_url$/i, typescript: "string", rust: "String", python: "str", go: "string", java: "String", csharp: "string" },
  { pattern: /_email$/i, typescript: "string", rust: "String", python: "str", go: "string", java: "String", csharp: "string" },
  { pattern: /_key$/i, typescript: "string", rust: "String", python: "str", go: "string", java: "String", csharp: "string" },
  { pattern: /_token$/i, typescript: "string", rust: "String", python: "str", go: "string", java: "String", csharp: "string" },
  { pattern: /_data$/i, typescript: "Record<string, unknown>", rust: "HashMap<String, Value>", python: "dict[str, Any]", go: "map[string]interface{}", java: "Map<String, Object>", csharp: "Dictionary<string, object>" },
  { pattern: /_metadata$/i, typescript: "Record<string, unknown>", rust: "HashMap<String, Value>", python: "dict[str, Any]", go: "map[string]interface{}", java: "Map<String, Object>", csharp: "Dictionary<string, object>" },
  { pattern: /_options$/i, typescript: "Record<string, unknown>", rust: "HashMap<String, Value>", python: "dict[str, Any]", go: "map[string]interface{}", java: "Map<String, Object>", csharp: "Dictionary<string, object>" },
  { pattern: /^input$/i, typescript: "unknown", rust: "Value", python: "Any", go: "interface{}", java: "Object", csharp: "object?" },
  { pattern: /^data$/i, typescript: "unknown", rust: "Value", python: "Any", go: "interface{}", java: "Object", csharp: "object?" },
  { pattern: /^context$/i, typescript: "Record<string, unknown>", rust: "HashMap<String, Value>", python: "dict[str, Any]", go: "map[string]interface{}", java: "Map<String, Object>", csharp: "Dictionary<string, object>" },
  { pattern: /^reason$/i, typescript: "string", rust: "String", python: "str", go: "string", java: "String", csharp: "string" },
  { pattern: /^currency$/i, typescript: "string", rust: "String", python: "str", go: "string", java: "String", csharp: "string" },
  { pattern: /^period$/i, typescript: "string", rust: "String", python: "str", go: "string", java: "String", csharp: "string" },
  { pattern: /^filters$/i, typescript: "Record<string, unknown>", rust: "HashMap<String, Value>", python: "dict[str, Any]", go: "map[string]interface{}", java: "Map<String, Object>", csharp: "Dictionary<string, object>" },
  { pattern: /^code$/i, typescript: "string", rust: "String", python: "str", go: "string", java: "String", csharp: "string" },
  { pattern: /^message$/i, typescript: "string", rust: "String", python: "str", go: "string", java: "String", csharp: "string" },
  { pattern: /^content$/i, typescript: "string", rust: "String", python: "str", go: "string", java: "String", csharp: "string" },
  { pattern: /^status$/i, typescript: "string", rust: "String", python: "str", go: "string", java: "String", csharp: "string" },
  { pattern: /^method$/i, typescript: "string", rust: "String", python: "str", go: "string", java: "String", csharp: "string" },
  { pattern: /^reference$/i, typescript: "string", rust: "String", python: "str", go: "string", java: "String", csharp: "string" },
  { pattern: /^amount$/i, typescript: "number", rust: "f64", python: "float", go: "float64", java: "BigDecimal", csharp: "decimal" },
  { pattern: /balance/i, typescript: "number", rust: "f64", python: "float", go: "float64", java: "BigDecimal", csharp: "decimal" },
  { pattern: /[Rr]eference$/i, typescript: "string", rust: "String", python: "str", go: "string", java: "String", csharp: "string" },
  { pattern: /^options$/i, typescript: "Record<string, unknown>", rust: "HashMap<String, Value>", python: "dict[str, Any]", go: "map[string]interface{}", java: "Map<String, Object>", csharp: "Dictionary<string, object>" },
];

export function inferType(fieldName: string, language: Language): string {
  const rule = TYPE_INFERENCE_RULES.find((r) => r.pattern.test(fieldName));
  if (rule) {
    const val = (rule as any)[language];
    if (val) return val;
    if (language === "php" && "string" in rule) return (rule as any)["string"];
    return "unknown";
  }
  return "unknown";
}

export function mapType(type: string, language: Language): string {
  const mapping = TYPE_MAPPINGS.find((m) => m.contractType === type);
  if (mapping) {
    const val = (mapping as any)[language];
    if (val) return val;
    return mapping.typescript;
  }

  if (type.endsWith("[]")) {
    const inner = type.slice(0, -2);
    const mappedInner = mapType(inner, language);
    switch (language) {
      case "typescript":
        return inner.endsWith("?") ? `(${mappedInner})[]` : `${mappedInner}[]`;
      case "rust":
        return `Vec<${mappedInner}>`;
      case "python":
        return `list[${mappedInner}]`;
      case "go":
        return `[]${mappedInner}`;
      case "java":
        return `List<${mappedInner}>`;
      case "csharp":
        return `List<${mappedInner}>`;
      case "php":
        return "array";
    }
  }

  if (type.endsWith("?")) {
    const inner = type.slice(0, -1);
    const mappedInner = mapType(inner, language);
    switch (language) {
      case "typescript":
        return `${mappedInner} | undefined`;
      case "rust":
        return `Option<${mappedInner}>`;
      case "python":
        return `Optional<${mappedInner}]`;
      case "go":
        return `*${mappedInner}`;
      case "java":
        return `Optional<${mappedInner}>`;
      case "csharp":
        return `${mappedInner}?`;
      case "php":
        return `?${mappedInner}`;
    }
  }

  return type;
}

export function pascalCase(str: string): string {
  return str
    .split(/[_\-.\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

export function camelCase(str: string): string {
  if (str.includes("_") || str.includes("-") || str.includes(" ")) {
    const pascal = pascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }
  return str;
}

export function snakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "")
    .replace(/[_\-.\s]+/g, "_");
}

export function kebabCase(str: string): string {
  return str
    .replace(/([A-Z])/g, "-$1")
    .toLowerCase()
    .replace(/^-/, "")
    .replace(/[_\-.\s]+/g, "-");
}

export function createTemplateData(module: string): TemplateData {
  return {
    module,
    pascalCase,
    camelCase,
    snakeCase,
    kebabCase,
    lowerCase: (str: string) => str.toLowerCase(),
    upperCase: (str: string) => str.toUpperCase(),
  };
}
