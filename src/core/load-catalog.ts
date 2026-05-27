import { readFile } from "node:fs/promises";
import { discoverContractFiles } from "./discovery.js";
import { parseCatalogFromDocuments } from "./parse-document.js";
import type { ParseMode, ParseResult, Catalog } from "./catalog.js";

export async function loadCatalogFromRoot(rootDir: string, mode: ParseMode): Promise<ParseResult<Catalog>> {
  const files = await discoverContractFiles(rootDir);
  const documents = await Promise.all(
    files.map(async (file) => ({
      file: file.file,
      text: await readFile(file.file, "utf8"),
    })),
  );

  return parseCatalogFromDocuments(documents, mode);
}
