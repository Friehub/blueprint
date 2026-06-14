import type {
  Catalog,
  CoreContract,
  ModuleContract,
  ParseMode,
  ParseResult,
} from "./catalog.js";

export type DocumentKind = "module" | "core";

export type ParseDocumentInput = {
  file: string;
  text: string;
  mode: ParseMode;
};

export type ParseCatalogInput = {
  rootDir: string;
  mode: ParseMode;
};

export type ParsedDocument = ModuleContract | CoreContract;

export type ParseDocumentResult = ParseResult<ParsedDocument>;

export type ParseCatalogResult = ParseResult<Catalog>;

export interface ContractParser {
  parseDocument(input: ParseDocumentInput): ParseDocumentResult;
  parseCatalog(input: ParseCatalogInput): ParseCatalogResult;
}

export function isModuleContract(value: ParsedDocument): value is ModuleContract {
  return (value as ModuleContract).profile === "module-v1";
}

export function isCoreContract(value: ParsedDocument): value is CoreContract {
  return (value as CoreContract).profile === "core-v1";
}
