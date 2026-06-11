import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import type { AliasMap } from "./types.js";

export function obfuscateName(seed: string, name: string): string {
  if (!seed) return name;
  const hash = createHash("sha256").update(seed + ":" + name).digest("hex");
  return "fn_" + hash.slice(0, 8);
}

/**
 * Loads blueprint.aliases.json5 from the given path.
 * Falls back silently if the file does not exist.
 * Uses a simple JSON5 parser since json5 npm dep isn't in the project.
 * Converts single-line // comments and multi-line /* *\/ comments before JSON.parse.
 */
export function loadAliases(path: string): AliasMap | null {
  if (!existsSync(path)) return null;

  try {
    let text = readFileSync(path, "utf8");

    // Strip single-line comments
    text = text.replace(/\/\/.*$/gm, "");
    // Strip multi-line comments
    text = text.replace(/\/\*[\s\S]*?\*\//g, "");

    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) return null;

    return {
      functions: parsed.functions,
      modules: parsed.modules,
      classes: parsed.classes,
      config: parsed.config,
    };
  } catch {
    return null;
  }
}

export function resolveTopicAlias(topicName: string, aliases?: AliasMap): string {
  if (!aliases?.topics) return topicName;
  return aliases.topics[topicName] ?? topicName;
}

export function resolveAlias(fnName: string, aliases?: AliasMap): string {
  if (!aliases?.functions) return fnName;
  return aliases.functions[fnName] ?? fnName;
}

export function resolveModuleAlias(moduleName: string, aliases?: AliasMap): string {
  if (!aliases?.modules) return moduleName;
  return aliases.modules[moduleName] ?? moduleName;
}

export function resolveClassAlias(className: string, aliases?: AliasMap): string {
  if (!aliases?.classes) return className;
  return aliases.classes[className] ?? className;
}

export function resolveConfigAlias(fieldName: string, aliases?: AliasMap): string {
  if (!aliases?.config) return fieldName;
  return aliases.config[fieldName] ?? fieldName;
}
