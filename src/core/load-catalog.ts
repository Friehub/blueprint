import { readFile } from "node:fs/promises";
import { discoverContractFiles, type DiscoveryWarning } from "./discovery.js";
import { parseCatalogFromDocuments } from "./parse-document.js";
import type { ParseMode, ParseResult, Catalog, ParseIssue } from "./catalog.js";

export type LoadResult = ParseResult<Catalog> & { discoveryWarnings: DiscoveryWarning[] };

export async function loadCatalogFromRoot(rootDir: string, mode: ParseMode): Promise<LoadResult> {
  const { files, warnings: discoveryWarnings } = await discoverContractFiles(rootDir);
  const documents = await Promise.all(
    files.map(async (file) => ({
      file: file.file,
      text: await readFile(file.file, "utf8"),
    })),
  );

  const result = parseCatalogFromDocuments(documents, mode);

  const discoveryIssues: ParseIssue[] = discoveryWarnings.map((w) => ({
    code: "UNSUPPORTED_SECTION",
    file: "",
    startLine: 0,
    endLine: 0,
    message: w.message,
    severity: "warning",
  }));

  return {
    value: result.value,
    issues: [...discoveryIssues, ...result.issues],
    discoveryWarnings,
  };
}
