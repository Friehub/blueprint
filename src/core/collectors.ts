import { classifySectionBody, parseSectionBody } from "./section-body.js";
import type { ContractFunction, ContractType, ParseIssue, ParseMode, RawSection } from "./catalog.js";

export function collectFunctions(file: string, sections: RawSection[], mode: ParseMode): { items: ContractFunction[]; issues: ParseIssue[] } {
  const items: ContractFunction[] = [];
  for (const section of sections) {
    const body = classifySectionBody(section.content, section.startLine, section.endLine);
    const parsed = parseSectionBody("functions", body, { file: section.file, startLine: section.startLine, endLine: section.endLine });
    if (parsed.kind === "functions") items.push(...parsed.items);
  }
  return { items, issues: [] };
}

export function collectTypes(file: string, sections: RawSection[], mode: ParseMode): { items: ContractType[]; issues: ParseIssue[] } {
  const items: ContractType[] = [];
  for (const section of sections) {
    const body = classifySectionBody(section.content, section.startLine, section.endLine);
    const parsed = parseSectionBody("types", body, { file: section.file, startLine: section.startLine, endLine: section.endLine });
    if (parsed.kind === "types") items.push(...parsed.items);
  }
  return { items, issues: [] };
}

export function collectTextSections(sections: RawSection[], _sectionName: string): string[] {
  const items: string[] = [];
  for (const section of sections) {
    const body = classifySectionBody(section.content, section.startLine, section.endLine);
    items.push(...body.lines.map((line) => stripTextLine(line)).filter(Boolean));
  }
  return items;
}

export function collectProviders(sections: RawSection[]): string[] {
  const items: string[] = [];
  for (const section of sections) {
    const body = classifySectionBody(section.content, section.startLine, section.endLine);
    for (const line of body.lines) {
      const text = stripTextLine(line);
      if (!text) continue;
      for (const chunk of text.split(",")) {
        if (chunk.trim()) items.push(chunk.trim());
      }
    }
  }
  return items;
}

export function parseDepList(raw: string): string[] {
  return raw.split(",").map((item) => item.replace(/\(.*?\)/g, "").trim()).filter(Boolean);
}

export function groupSections(sections: RawSection[]): Map<string, RawSection[]> {
  const grouped = new Map<string, RawSection[]>();
  for (const section of sections) {
    const list = grouped.get(section.name) ?? [];
    list.push(section);
    grouped.set(section.name, list);
  }
  return grouped;
}

export function extractSummary(preamble: string | null): string | null {
  if (!preamble) return null;
  const lines = preamble.split(/\r?\n/).map((line) => line.trim());
  return lines.find((line) => line && !line.startsWith("#") && line !== "---") ?? null;
}

export function stripTextLine(line: string): string {
  return line.trim().replace(/^[-*+]\s+/, "").trim();
}

type DepResult = { hardDeps: string[]; softDeps: string[] };

export function extractDependencies(sections: RawSection[]): DepResult {
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
        if (raw && !raw.startsWith("(none")) hardDeps.push(...parseDepList(raw));
        continue;
      }
      const recommendsMatch = text.match(/\*\*Recommends:\*\*\s*(.+)/i);
      if (recommendsMatch) {
        const raw = recommendsMatch[1]?.trim() ?? "";
        if (raw && !raw.startsWith("(none")) softDeps.push(...parseDepList(raw));
      }
    }
  }
  return { hardDeps, softDeps };
}

export function extractCoreInherits(sections: RawSection[]): string[] {
  const inherits: string[] = [];
  for (const section of sections) {
    const body = classifySectionBody(section.content, section.startLine, section.endLine);
    for (const line of body.lines) {
      const text = stripTextLine(line);
      if (!text) continue;

      const runtimeMatch = text.match(/\*\*Runtime Standards:\*\*\s*Inherits\s+`([^`]+)`/i);
      if (runtimeMatch) {
        const name = (runtimeMatch[1] ?? "").replace(/.*\//, "").replace(/\.md$/i, "");
        if (name && !inherits.includes(name)) inherits.push(name);
        continue;
      }

      const globalMatch = text.match(/\*\*Global Standards:\*\*\s*Inherits\s+`([^`]+)`/i);
      if (globalMatch) {
        const name = (globalMatch[1] ?? "").replace(/.*\//, "").replace(/\.md$/i, "");
        if (name && !inherits.includes(name)) inherits.push(name);
      }
    }
  }
  return inherits;
}

export function issue(file: string, section: string, startLine: number, endLine: number, message: string, code: ParseIssue["code"], mode: ParseMode): ParseIssue {
  return { code, file, section, startLine, endLine, message, severity: mode === "strict" ? "error" : "warning" };
}
