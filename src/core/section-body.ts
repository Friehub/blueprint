import type { ContractFunction, ContractParameter, ContractType, SourceRef } from "./catalog.js";
import type { SectionName } from "./sections.js";

export type SectionBodyKind = "fenced" | "bullets" | "paragraphs" | "mixed" | "raw";

export type SectionBody = {
  kind: SectionBodyKind;
  raw: string;
  lines: string[];
  startLine: number;
  endLine: number;
};

export type ParsedSectionBody =
  | { kind: "functions"; items: ContractFunction[]; raw: string; source: SourceRef }
  | { kind: "types"; items: ContractType[]; raw: string; source: SourceRef }
  | { kind: "text"; items: string[]; raw: string; source: SourceRef };

const FENCED_BLOCK_RE = /^```(?:[a-zA-Z0-9_-]+)?\s*$/;
const FUNCTION_SIGNATURE_RE = /^([A-Za-z_][A-Za-z0-9_]*)(?:<[^>]+>)?\s*\((.*)\)\s*→\s*(.+)$/;
const TYPE_ALIAS_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/;
const TYPE_RECORD_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*\{\s*(.+)\s*\}$/;

export function classifySectionBody(text: string, startLine: number, endLine: number): SectionBody {
  const lines = text.split(/\r?\n/);
  const nonEmpty = lines.filter((line) => line.trim().length > 0);
  const hasFence = nonEmpty.some((line) => FENCED_BLOCK_RE.test(line.trim()));
  const hasBullets = nonEmpty.some((line) => /^[-*+]\s+/.test(line.trim()));

  if (hasFence && hasBullets) {
    return { kind: "mixed", raw: text, lines, startLine, endLine };
  }

  if (hasFence) {
    return { kind: "fenced", raw: text, lines, startLine, endLine };
  }

  if (hasBullets) {
    return { kind: "bullets", raw: text, lines, startLine, endLine };
  }

  if (nonEmpty.length > 1) {
    return { kind: "paragraphs", raw: text, lines, startLine, endLine };
  }

  return { kind: "raw", raw: text, lines, startLine, endLine };
}

export function parseFunctionSignatureLine(line: string, source: SourceRef): ContractFunction | null {
  const trimmed = line.trim().replace(/^#{2,3}\s+/, "").replace(/^`(.+)`$/, "$1");
  if (!trimmed) return null;

  const match = trimmed.match(FUNCTION_SIGNATURE_RE);
  if (!match) return null;

  const [, name = "", paramsRaw = "", returns = ""] = match;
  const params = paramsRaw.trim() ? parseParameters(paramsRaw) : [];

  return {
    name,
    params,
    returns: returns.trim(),
    signature: trimmed,
    raw: line,
    source,
  };
}

export function parseTypeLine(line: string, source: SourceRef): ContractType | null {
  const trimmed = line.trim().replace(/^#{2,3}\s+/, "");
  if (!trimmed) return null;

  const typeKeyword = trimmed.match(/^type\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
  if (typeKeyword) {
    return {
      name: typeKeyword[1] ?? "",
      raw: trimmed,
      source,
    };
  }

  const interfaceKeyword = trimmed.match(/^interface\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/);
  if (interfaceKeyword) {
    return {
      name: interfaceKeyword[1] ?? "",
      raw: trimmed,
      source,
    };
  }

  const alias = trimmed.match(TYPE_ALIAS_RE);
  if (alias) {
    return {
      name: alias[1] ?? "",
      raw: trimmed,
      source,
    };
  }

  const record = trimmed.match(TYPE_RECORD_RE);
  if (record) {
    return {
      name: record[1] ?? "",
      raw: trimmed,
      source,
    };
  }

  return null;
}

export function collectMultiLineTypes(body: SectionBody, source: SourceRef): ContractType[] {
  const items: ContractType[] = [];
  const lines = body.lines;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!.trim();
    if (!line || line.startsWith("```") || /^[-*+]\s+/.test(line)) {
      i++;
      continue;
    }

    const typeMatch = line.match(/^type\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\{/);
    if (typeMatch) {
      const name = typeMatch[1] ?? "";
      const startLine = i;
      let raw = line;
      let braceDepth = 1;
      i++;

      while (i < lines.length && braceDepth > 0) {
        const nextLine = lines[i]!.trim();
        raw += "\n" + nextLine;
        for (const ch of nextLine) {
          if (ch === "{") braceDepth++;
          if (ch === "}") braceDepth--;
        }
        if (braceDepth === 0) break;
        i++;
      }

      items.push({
        name,
        raw,
        source: {
          file: source.file,
          startLine: source.startLine + startLine,
          endLine: source.startLine + i,
        },
      });
      i++;
      continue;
    }

    const parsed = parseTypeLine(line, {
      file: source.file,
      startLine: source.startLine + i,
      endLine: source.startLine + i,
    });
    if (parsed) items.push(parsed);
    i++;
  }

  return items;
}

export function parseParameters(paramsRaw: string): ContractParameter[] {
  return splitTopLevel(paramsRaw, ",")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [left, defaultValue] = splitOnce(chunk, "=");
      const [namePart, typePart] = splitOnce(left.trim(), ":");
      const optional = namePart.trim().endsWith("?");
      const name = namePart.trim().replace(/\?$/, "");

      const parameter: ContractParameter = {
        name,
        type: typePart ? typePart.trim() : null,
        optional,
      };

      if (defaultValue !== undefined) {
        parameter.defaultValue = defaultValue.trim();
      }

      return parameter;
    });
}

export function splitOnce(input: string, delimiter: string): [string, string | undefined] {
  const index = input.indexOf(delimiter);
  if (index === -1) return [input, undefined];
  return [input.slice(0, index), input.slice(index + delimiter.length)];
}

export function splitTopLevel(input: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  const delimiterChar = delimiter[0] ?? ",";

  for (const ch of input) {
    if (ch === "<" || ch === "(" || ch === "[") depth += 1;
    if (ch === ">" || ch === ")" || ch === "]") depth = Math.max(0, depth - 1);

    if (ch === delimiterChar && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.length > 0) parts.push(current);
  return parts;
}

export function parseSectionBody(
  section: SectionName,
  body: SectionBody,
  source: SourceRef,
): ParsedSectionBody {
  if (section === "functions") {
    const items = parseBodyLines(body, source, parseFunctionSignatureLine);
    return { kind: "functions", items, raw: body.raw, source };
  }

  if (section === "types") {
    const items = collectMultiLineTypes(body, source);
    return { kind: "types", items, raw: body.raw, source };
  }

  return {
    kind: "text",
    items: body.lines.map((line) => line.trim()).filter(Boolean),
    raw: body.raw,
    source,
  };
}

function parseBodyLines<T>(
  body: SectionBody,
  source: SourceRef,
  parser: (line: string, source: SourceRef) => T | null,
): T[] {
  const items: T[] = [];
  const lines = body.lines;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!.trim();
    if (!line) continue;
    if (line.startsWith("```") || /^[-*+]\s+/.test(line)) continue;

    const parsed = parser(line, {
      file: source.file,
      startLine: body.startLine + index,
      endLine: body.startLine + index,
    });

    if (parsed) items.push(parsed);
  }

  return items;
}
