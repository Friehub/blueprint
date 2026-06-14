import { SECTION_DEFINITIONS, normalizeSectionHeader } from "./sections.js";
import type { DocumentEnvelope } from "./envelope.js";
import type { RawSection, SourceRef } from "./catalog.js";

export type ScannedDocument = {
  envelope: DocumentEnvelope;
  preamble: { content: string; startLine: number; endLine: number } | null;
  sections: RawSection[];
  source: SourceRef;
};

const H1_RE = /^#\s+(.+)$/;
const H3_RE = /^###\s+(.+)$/;
const H2_RE = /^##\s+(.+)$/;
const SEPARATOR_RE = /^---\s*$/;

export function scanDocument(file: string, text: string): ScannedDocument {
  const lines = text.split(/\r?\n/);
  const source = { file, startLine: 1, endLine: Math.max(1, lines.length) };
  const envelope = parseEnvelope(file, lines);
  const sections: RawSection[] = [];

  let preambleStart = -1;
  let preambleEnd = -1;
  let currentSection: RawSection | null = null;
  let seenFirstKnownSection = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const lineNumber = index + 1;
    const trimmed = line.trim();

    if (lineNumber === envelope.titleLine || SEPARATOR_RE.test(trimmed)) {
      continue;
    }

    const sectionHeader = detectSectionHeader(trimmed, envelope.kind);
    if (sectionHeader) {
      if (!seenFirstKnownSection) {
        seenFirstKnownSection = true;
      }

      if (currentSection) {
        currentSection.endLine = lineNumber - 1;
        sections.push(currentSection);
      }

      currentSection = {
        file,
        name: sectionHeader.name,
        aliases: sectionHeader.aliases,
        kind: sectionHeader.kind,
        content: sectionHeader.inlineContent ? `${sectionHeader.inlineContent}\n` : "",
        startLine: lineNumber,
        endLine: lineNumber,
      };
      continue;
    }

    if (!seenFirstKnownSection) {
      if (trimmed) {
        if (preambleStart === -1) preambleStart = lineNumber;
        preambleEnd = lineNumber;
      }
      continue;
    }

    if (currentSection) {
      currentSection.content += line + "\n";
      currentSection.endLine = lineNumber;
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  const preamble =
    preambleStart === -1
      ? null
      : {
          content: lines.slice(preambleStart - 1, preambleEnd).join("\n").trim(),
          startLine: preambleStart,
          endLine: preambleEnd,
        };

  return {
    envelope,
    preamble,
    sections,
    source,
  };
}

function parseEnvelope(file: string, lines: string[]): DocumentEnvelope {
  const kind = /(^|[\\/])core([\\/]|$)/.test(file) ? "core" : "module";
  const headingLine = lines.findIndex((line) => /^#{1,3}\s+/.test(line.trim()));
  const titleLine = headingLine === -1 ? 1 : headingLine + 1;
  const titleText = headingLine === -1 ? basenameWithoutExtension(file) : lines[headingLine]!.trim().replace(/^#{1,3}\s+/, "");

  if (headingLine === -1) {
    return {
      kind,
      name: basenameWithoutExtension(file),
      title: basenameWithoutExtension(file),
      titleLine,
      source: { file, startLine: 1, endLine: 1 },
    };
  }

  if (kind === "module") {
    const nameMatch = titleText.match(/`([^`]+)`/) ?? titleText.match(/Module Contract:\s*(.+)$/i);
    return {
      kind,
      name: (nameMatch?.[1] ?? basenameWithoutExtension(file)).trim(),
      title: titleText,
      titleLine,
      source: { file, startLine: 1, endLine: 1 },
    };
  }

  return {
    kind,
    name: basenameWithoutExtension(file),
    title: titleText,
    titleLine,
    source: { file, startLine: 1, endLine: 1 },
  };
}

function detectSectionHeader(
  trimmedLine: string,
  kind: DocumentEnvelope["kind"],
): { name: string; aliases: string[]; kind: "known" | "unknown"; inlineContent?: string } | null {
  const inlineMatch = matchKnownHeaderWithInlineContent(trimmedLine);
  if (inlineMatch) return inlineMatch;

  const headingText = trimmedLine.replace(/^#{2,3}\s+/, "").trim();
  const normalized = normalizeSectionHeader(headingText);
  if (normalized) {
    return {
      name: normalized,
      aliases: [],
      kind: "known",
    };
  }

  if (H2_RE.test(trimmedLine)) {
    return {
      name: headingText,
      aliases: [],
      kind: "unknown",
    };
  }

  if (H3_RE.test(trimmedLine)) {
    if (kind === "core") {
      return {
        name: headingText,
        aliases: [],
        kind: "unknown",
      };
    }

    return null;
  }

  return null;
}

function matchKnownHeaderWithInlineContent(
  line: string,
): { name: string; aliases: string[]; kind: "known"; inlineContent?: string } | null {
  for (const definition of SECTION_DEFINITIONS) {
    const candidates = [definition.header, ...definition.aliases];
    for (const candidate of candidates) {
      const lowerCandidate = candidate.toLowerCase();
      const lowerLine = line.toLowerCase();
      if (!lowerLine.startsWith(lowerCandidate)) continue;

      const remainder = line.slice(candidate.length).trim();
      if (remainder && !/^\s/.test(line.slice(candidate.length, candidate.length + 1))) {
        // If the next character is not whitespace, it's likely a different token.
        continue;
      }

      return {
        name: definition.name,
        aliases: [candidate],
        kind: "known",
        inlineContent: remainder,
      };
    }
  }

  return null;
}

function basenameWithoutExtension(file: string): string {
  const parts = file.split(/[\\/]/);
  const filename = parts[parts.length - 1] ?? file;
  return filename.replace(/\.md$/i, "");
}
