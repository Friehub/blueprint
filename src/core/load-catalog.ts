import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { discoverContractFiles, type DiscoveryWarning } from "./discovery.js";
import { parseCatalogFromDocuments } from "./parse-document.js";
import type { ParseMode, ParseResult, Catalog, ParseIssue } from "./catalog.js";

export type LoadResult = ParseResult<Catalog> & { discoveryWarnings: DiscoveryWarning[] };

export async function loadCatalogFromRoot(rootDir: string, mode: ParseMode): Promise<LoadResult> {
  const contractsDir = join(rootDir, "contracts");
  const contractsExist = existsSync(contractsDir) && (await hasMarkdownFiles(contractsDir));

  if (contractsExist) {
    // Live mode: parse markdown contracts from the repo
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

  // Fallback: load pre-compiled catalog from dist/catalog.json
  // This ships with the npm package so code generation works without raw contracts.
  const catalogPath = join(rootDir, "dist", "catalog.json");
  try {
    const text = await readFile(catalogPath, "utf8");
    const catalog = JSON.parse(text) as Catalog;
    return {
      value: catalog,
      issues: [],
      discoveryWarnings: [],
    };
  } catch {
    return {
      value: null,
      issues: [{
        code: "CATALOG_NOT_FOUND",
        file: "",
        startLine: 0,
        endLine: 0,
        message: "No contract files or compiled catalog found. Clone the repo or run from a directory with contracts/ or dist/catalog.json.",
        severity: "error",
      }],
      discoveryWarnings: [],
    };
  }
}

async function hasMarkdownFiles(dir: string): Promise<boolean> {
  try {
    const entries = await readdir(dir);
    return entries.some((e) => e.endsWith(".md"));
  } catch {
    return false;
  }
}
