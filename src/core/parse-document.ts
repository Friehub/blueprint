import { classifySectionBody, parseSectionBody } from "./section-body.js";
import { SECTION_DEFINITIONS } from "./sections.js";
import { scanDocument } from "./scanner.js";
import type { Catalog, ContractFunction, ContractType, CoreContract, ModuleContract, ParseIssue, ParseMode, ParseResult, RawSection } from "./catalog.js";
import type { DocumentEnvelope } from "./envelope.js";
import {
  collectFunctions, collectTypes, collectTextSections, collectProviders,
  extractDependencies, extractCoreInherits, groupSections, extractSummary, extractVersion, issue,
  collectAlgorithmSection,
} from "./collectors.js";

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
  const version = extractVersion(preamble);
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
  const algorithm = collectAlgorithmSection(grouped.get("system-integrations") ?? []);

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
      version,
      summary,
      functions,
      types,
      invariants,
      providers,
      integrations,
      algorithm,
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
  const version = extractVersion(preamble);
  const title = envelope.title;

  return {
    value: {
      name: envelope.name,
      title,
      version,
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

