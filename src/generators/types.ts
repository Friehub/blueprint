import type { Catalog, ModuleContract, CoreContract, ContractFunction, ContractType } from "../core/catalog.js";
import type { AdapterDefinition } from "../core/adapters/types.js";

export type Language = "typescript" | "rust" | "python" | "go";

export type GenerationType = "interfaces" | "adapters" | "tests" | "all";

export interface GeneratorContext {
  catalog: Catalog;
  adapters: AdapterDefinition[];
  module: string | undefined;
  provider: string | undefined;
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
}

export const TYPE_MAPPINGS: TypeMapping[] = [
  { contractType: "string", typescript: "string", rust: "String", python: "str", go: "string" },
  { contractType: "number", typescript: "number", rust: "f64", python: "float", go: "float64" },
  { contractType: "boolean", typescript: "boolean", rust: "bool", python: "bool", go: "bool" },
  { contractType: "null", typescript: "null", rust: "Option::None", python: "None", go: "nil" },
];

export const TYPE_INFERENCE_RULES: Array<{ pattern: RegExp; typescript: string; rust: string; python: string; go: string }> = [
  { pattern: /^id$/i, typescript: "string", rust: "String", python: "str", go: "string" },
  { pattern: /_id$/i, typescript: "string", rust: "String", python: "str", go: "string" },
  { pattern: /_at$/i, typescript: "Timestamp", rust: "DateTime<Utc>", python: "str", go: "time.Time" },
  { pattern: /_count$/i, typescript: "number", rust: "i64", python: "int", go: "int" },
  { pattern: /_amount$/i, typescript: "number", rust: "f64", python: "float", go: "float64" },
  { pattern: /_price$/i, typescript: "number", rust: "f64", python: "float", go: "float64" },
  { pattern: /_total$/i, typescript: "number", rust: "f64", python: "float", go: "float64" },
  { pattern: /is_/i, typescript: "boolean", rust: "bool", python: "bool", go: "bool" },
  { pattern: /has_/i, typescript: "boolean", rust: "bool", python: "bool", go: "bool" },
  { pattern: /_status$/i, typescript: "string", rust: "String", python: "str", go: "string" },
  { pattern: /_type$/i, typescript: "string", rust: "String", python: "str", go: "string" },
  { pattern: /_name$/i, typescript: "string", rust: "String", python: "str", go: "string" },
  { pattern: /_url$/i, typescript: "string", rust: "String", python: "str", go: "string" },
  { pattern: /_email$/i, typescript: "string", rust: "String", python: "str", go: "string" },
  { pattern: /_key$/i, typescript: "string", rust: "String", python: "str", go: "string" },
  { pattern: /_token$/i, typescript: "string", rust: "String", python: "str", go: "string" },
  { pattern: /_data$/i, typescript: "Record<string, unknown>", rust: "HashMap<String, Value>", python: "dict[str, Any]", go: "map[string]interface{}" },
  { pattern: /_metadata$/i, typescript: "Record<string, unknown>", rust: "HashMap<String, Value>", python: "dict[str, Any]", go: "map[string]interface{}" },
  { pattern: /_options$/i, typescript: "Record<string, unknown>", rust: "HashMap<String, Value>", python: "dict[str, Any]", go: "map[string]interface{}" },
];

export function inferType(fieldName: string, language: Language): string {
  const rule = TYPE_INFERENCE_RULES.find((r) => r.pattern.test(fieldName));
  if (rule) {
    return rule[language];
  }
  return "unknown";
}

export function mapType(type: string, language: Language): string {
  const mapping = TYPE_MAPPINGS.find((m) => m.contractType === type);
  if (mapping) {
    return mapping[language];
  }

  if (type.endsWith("[]")) {
    const inner = type.slice(0, -2);
    const mappedInner = mapType(inner, language);
    switch (language) {
      case "typescript":
        return `${mappedInner}[]`;
      case "rust":
        return `Vec<${mappedInner}>`;
      case "python":
        return `list[${mappedInner}]`;
      case "go":
        return `[]${mappedInner}`;
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
        return `Optional[${mappedInner}]`;
      case "go":
        return `*${mappedInner}`;
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
