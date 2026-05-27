import { classifySectionBody, parseSectionBody } from "./section-body.js";
import { SECTION_DEFINITIONS } from "./sections.js";
import { scanDocument } from "./scanner.js";
import type {
  Catalog,
  ContractFunction,
  ContractType,
  CoreContract,
  ModuleContract,
  ParseIssue,
  ParseMode,
  ParseResult,
  RawSection,
} from "./catalog.js";
import type { DocumentEnvelope } from "./envelope.js";

export type ParsedDocument = ModuleContract | CoreContract;

export function parseDocument(file: string, text: string, mode: ParseMode): ParseResult<ParsedDocument> {
  const scanned = scanDocument(file, text);
  const issues: ParseIssue[] = [];

  if (scanned.envelope.kind === "module") {
    const result = parseModuleDocument(scanned.envelope, scanned.preamble?.content ?? null, scanned.sections, mode);
    issues.push(...result.issues);
    if (mode === "strict" && issues.some((issue) => issue.severity === "error")) {
      return { value: null, issues };
    }
    return { value: result.value, issues };
  }

  const result = parseCoreDocument(scanned.envelope, scanned.preamble?.content ?? null, scanned.sections, mode);
  issues.push(...result.issues);
  if (mode === "strict" && issues.some((issue) => issue.severity === "error")) {
    return { value: null, issues };
  }

  return { value: result.value, issues };
}

export function parseCatalogFromDocuments(documents: Array<{ file: string; text: string }>, mode: ParseMode): ParseResult<Catalog> {
  const modules: ModuleContract[] = [];
  const core: CoreContract[] = [];
  const issues: ParseIssue[] = [];

  for (const document of documents) {
    const result = parseDocument(document.file, document.text, mode);
    issues.push(...result.issues);
    if (!result.value) continue;

    if (result.value.profile === "module-v1") {
      modules.push(result.value);
    } else {
      core.push(result.value);
    }
  }

  if (mode === "strict" && issues.some((issue) => issue.severity === "error")) {
    return { value: null, issues };
  }

  return { value: { modules, core }, issues };
}

function parseModuleDocument(
  envelope: DocumentEnvelope,
  preamble: string | null,
  sections: RawSection[],
  mode: ParseMode,
): ParseResult<ModuleContract> {
  const issues: ParseIssue[] = [];
  const summary = extractSummary(preamble);
  const grouped = groupSections(sections);
  const required = SECTION_DEFINITIONS.filter(
    (definition: (typeof SECTION_DEFINITIONS)[number]) => definition.requiredForModule,
  ).map((definition) => definition.name);

  for (const sectionName of required) {
    if (!grouped.has(sectionName)) {
      issues.push(issue(envelope.source.file, sectionName, 1, 1, `Missing required section: ${sectionName}`, "MISSING_SECTION", mode));
    }
  }

  const title = envelope.name;
  const name = envelope.name;

  const functionResult = collectFunctions(envelope.source.file, grouped.get("functions") ?? [], mode);
  const typeResult = collectTypes(envelope.source.file, grouped.get("types") ?? [], mode);
  issues.push(...functionResult.issues, ...typeResult.issues);

  const functions = functionResult.items;
  const types = typeResult.items;
  const invariants = collectTextSections(grouped.get("invariants") ?? [], "invariants");
  const providers = collectProviders(grouped.get("providers") ?? []);
  const integrations = collectTextSections(grouped.get("system-integrations") ?? [], "system-integrations");
  const { hardDeps, softDeps } = extractDependencies(grouped.get("system-integrations") ?? []);
  const coreInherits = extractCoreInherits(grouped.get("system-integrations") ?? []);

  const rawSections = sections;

  for (const [sectionName, groupedSections] of grouped.entries()) {
    if (groupedSections.length > 1) {
      const first = groupedSections[0]!;
      const last = groupedSections[groupedSections.length - 1]!;
      issues.push(issue(envelope.source.file, sectionName, first.startLine, last.endLine, `Duplicate section: ${sectionName}`, "DUPLICATE_SECTION", mode));
    }
  }

  return {
    value: {
      name,
      title,
      summary,
      functions,
      types,
      invariants,
      providers,
      integrations,
      hardDeps,
      softDeps,
      coreInherits,
      rawSections,
      profile: "module-v1",
      source: { file: envelope.source.file, startLine: 1, endLine: Math.max(1, sections.at(-1)?.endLine ?? 1) },
    },
    issues,
  };
}

const IMPLICIT_CORE_NAMES = new Set(["global_standards", "runtime_standards"]);

function parseCoreDocument(
  envelope: DocumentEnvelope,
  preamble: string | null,
  sections: RawSection[],
  _mode: ParseMode,
): ParseResult<CoreContract> {
  const summary = extractSummary(preamble);
  const title = envelope.title;

  return {
    value: {
      name: envelope.name,
      title,
      summary,
      sections,
      rawSections: sections,
      implicit: IMPLICIT_CORE_NAMES.has(envelope.name),
      profile: "core-v1",
      source: { file: envelope.source.file, startLine: 1, endLine: Math.max(1, sections.at(-1)?.endLine ?? 1) },
    },
    issues: [],
  };
}

function collectFunctions(file: string, sections: RawSection[], mode: ParseMode): { items: ContractFunction[]; issues: ParseIssue[] } {
  const items: ContractFunction[] = [];

  for (const section of sections) {
    const body = classifySectionBody(section.content, section.startLine, section.endLine);
    const parsed = parseSectionBody("functions", body, { file: section.file, startLine: section.startLine, endLine: section.endLine });
    if (parsed.kind === "functions") {
      items.push(...parsed.items);
    }
  }

  return { items, issues: [] };
}

function collectTypes(file: string, sections: RawSection[], mode: ParseMode): { items: ContractType[]; issues: ParseIssue[] } {
  const items: ContractType[] = [];

  for (const section of sections) {
    const body = classifySectionBody(section.content, section.startLine, section.endLine);
    const parsed = parseSectionBody("types", body, { file: section.file, startLine: section.startLine, endLine: section.endLine });
    if (parsed.kind === "types") {
      items.push(...parsed.items);
    }
  }

  return { items, issues: [] };
}

function collectTextSections(sections: RawSection[], _sectionName: string): string[] {
  const items: string[] = [];

  for (const section of sections) {
    const body = classifySectionBody(section.content, section.startLine, section.endLine);
    items.push(...body.lines.map((line: string) => stripTextLine(line)).filter(Boolean));
  }

  return items;
}

function collectProviders(sections: RawSection[]): string[] {
  const items: string[] = [];

  for (const section of sections) {
    const body = classifySectionBody(section.content, section.startLine, section.endLine);
    for (const line of body.lines) {
      const text = stripTextLine(line);
      if (!text) continue;
      for (const chunk of text.split(",")) {
        const provider = chunk.trim();
        if (provider) items.push(provider);
      }
    }
  }

  return items;
}

function extractDependencies(sections: RawSection[]): { hardDeps: string[]; softDeps: string[] } {
  const hardDeps: string[] = [];
  const softDeps: string[] = [];

  for (const section of sections) {
    const body = classifySectionBody(section.content, section.startLine, section.endLine);
    for (const line of body.lines) {
      const text = stripTextLine(line);
      if (!text) continue;

      const dependsMatch = text.match(/\*\*Depends On:\*\*\s*(.+)/i);
      if (dependsMatch) {
        const raw = dependsMatch[1]?.trim() ?? "";
        if (raw && !raw.startsWith("(none")) {
          hardDeps.push(...parseDepList(raw));
        }
        continue;
      }

      const recommendsMatch = text.match(/\*\*Recommends:\*\*\s*(.+)/i);
      if (recommendsMatch) {
        const raw = recommendsMatch[1]?.trim() ?? "";
        if (raw && !raw.startsWith("(none")) {
          softDeps.push(...parseDepList(raw));
        }
      }
    }
  }

  return { hardDeps, softDeps };
}

function extractCoreInherits(sections: RawSection[]): string[] {
  const inherits: string[] = [];

  for (const section of sections) {
    const body = classifySectionBody(section.content, section.startLine, section.endLine);
    for (const line of body.lines) {
      const text = stripTextLine(line);
      if (!text) continue;

      const runtimeMatch = text.match(/\*\*Runtime Standards:\*\*\s*Inherits\s+`([^`]+)`/i);
      if (runtimeMatch) {
        const rawPath = runtimeMatch[1] ?? "";
        const name = rawPath.replace(/.*\//, "").replace(/\.md$/i, "");
        if (name && !inherits.includes(name)) {
          inherits.push(name);
        }
        continue;
      }

      const globalMatch = text.match(/\*\*Global Standards:\*\*\s*Inherits\s+`([^`]+)`/i);
      if (globalMatch) {
        const rawPath = globalMatch[1] ?? "";
        const name = rawPath.replace(/.*\//, "").replace(/\.md$/i, "");
        if (name && !inherits.includes(name)) {
          inherits.push(name);
        }
      }
    }
  }

  return inherits;
}

function parseDepList(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.replace(/\(.*?\)/g, "").trim())
    .filter(Boolean);
}

function groupSections(sections: RawSection[]): Map<string, RawSection[]> {
  const grouped = new Map<string, RawSection[]>();

  for (const section of sections) {
    const list = grouped.get(section.name) ?? [];
    list.push(section);
    grouped.set(section.name, list);
  }

  return grouped;
}

function extractSummary(preamble: string | null): string | null {
  if (!preamble) return null;

  const lines = preamble.split(/\r?\n/).map((line) => line.trim());
  const summaryLine = lines.find((line) => line && !line.startsWith("#") && line !== "---");
  return summaryLine ?? null;
}

function stripTextLine(line: string): string {
  return line
    .trim()
    .replace(/^[-*+]\s+/, "")
    .trim();
}

function issue(
  file: string,
  section: string,
  startLine: number,
  endLine: number,
  message: string,
  code: ParseIssue["code"],
  mode: ParseMode,
): ParseIssue {
  return {
    code,
    file,
    section,
    startLine,
    endLine,
    message,
    severity: mode === "strict" ? "error" : "warning",
  };
}
