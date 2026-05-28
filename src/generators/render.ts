import Handlebars from "handlebars";
import type { TemplateData } from "./types.js";

export type Template = {
  name: string;
  content: string;
};

export type RenderContext = {
  data: TemplateData;
  [key: string]: unknown;
};

Handlebars.registerHelper("pascalCase", (str: string) => {
  return str
    .split(/[_\-.\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
});

Handlebars.registerHelper("camelCase", (str: string) => {
  const pascal = str
    .split(/[_\-.\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
});

Handlebars.registerHelper("snakeCase", (str: string) => {
  return str
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "")
    .replace(/[_\-.\s]+/g, "_");
});

Handlebars.registerHelper("kebabCase", (str: string) => {
  return str
    .replace(/([A-Z])/g, "-$1")
    .toLowerCase()
    .replace(/^-/, "")
    .replace(/[_\-.\s]+/g, "-");
});

Handlebars.registerHelper("lowerCase", (str: string) => str.toLowerCase());

Handlebars.registerHelper("upperCase", (str: string) => str.toUpperCase());

Handlebars.registerHelper("mapType", (type: string, language: string) => {
  const TYPE_MAPPINGS: Record<string, Record<string, string>> = {
    string: { typescript: "string", rust: "String", python: "str", go: "string" },
    number: { typescript: "number", rust: "f64", python: "float", go: "float64" },
    boolean: { typescript: "boolean", rust: "bool", python: "bool", go: "bool" },
    null: { typescript: "null", rust: "Option::None", python: "None", go: "nil" },
  };

  const mapping = TYPE_MAPPINGS[type]?.[language];
  if (mapping) return mapping;

  if (type.endsWith("[]")) {
    const inner = type.slice(0, -2);
    const mappedInner = mapTypeHelper(inner, language);
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
    const mappedInner = mapTypeHelper(inner, language);
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
});

function mapTypeHelper(type: string, language: string): string {
  const TYPE_MAPPINGS: Record<string, Record<string, string>> = {
    string: { typescript: "string", rust: "String", python: "str", go: "string" },
    number: { typescript: "number", rust: "f64", python: "float", go: "float64" },
    boolean: { typescript: "boolean", rust: "bool", python: "bool", go: "bool" },
    null: { typescript: "null", rust: "Option::None", python: "None", go: "nil" },
  };

  const mapping = TYPE_MAPPINGS[type]?.[language];
  if (mapping) return mapping;

  if (type.endsWith("[]")) {
    const inner = type.slice(0, -2);
    const mappedInner = mapTypeHelper(inner, language);
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
    const mappedInner = mapTypeHelper(inner, language);
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

Handlebars.registerHelper("inferType", (fieldName: string, language: string) => {
  const TYPE_INFERENCE_RULES: Array<{ pattern: RegExp; typescript: string; rust: string; python: string; go: string }> = [
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

  const rule = TYPE_INFERENCE_RULES.find((r) => r.pattern.test(fieldName));
  if (rule) {
    return rule[language as keyof typeof rule] ?? "unknown";
  }
  return "unknown";
});

export function renderTemplate(template: string, context: RenderContext): string {
  const compiled = Handlebars.compile(template);
  return compiled(context);
}

export function renderTemplateFile(templatePath: string, context: RenderContext): string {
  const template = Handlebars.compile(templatePath);
  return template(context);
}
