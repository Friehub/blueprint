export type Catalog = {
  modules: ModuleContract[];
  core: CoreContract[];
};

export type ModuleProfile = "module-v1";
export type CoreProfile = "core-v1";

export type SourceRef = {
  file: string;
  startLine: number;
  endLine: number;
};

export type RawSection = {
  file: string;
  name: string;
  aliases: string[];
  kind: "known" | "unknown";
  content: string;
  startLine: number;
  endLine: number;
};

export type ModuleContract = {
  name: string;
  title: string;
  summary: string | null;
  functions: ContractFunction[];
  types: ContractType[];
  invariants: string[];
  providers: string[];
  integrations: string[];
  rawSections: RawSection[];
  profile: ModuleProfile;
  source: SourceRef;
};

export type CoreContract = {
  name: string;
  title: string;
  summary: string | null;
  sections: RawSection[];
  rawSections: RawSection[];
  profile: CoreProfile;
  source: SourceRef;
};

export type ContractParameter = {
  name: string;
  type: string | null;
  optional: boolean;
  defaultValue?: string;
};

export type ContractFunction = {
  name: string;
  params: ContractParameter[];
  returns: string;
  signature: string;
  raw: string;
  source: SourceRef;
};

export type ContractType = {
  name: string;
  raw: string;
  source: SourceRef;
};

export type ParseMode = "strict" | "loose";

export type ParseIssueCode =
  | "MISSING_SECTION"
  | "DUPLICATE_SECTION"
  | "MALFORMED_FUNCTION_BLOCK"
  | "MALFORMED_TYPE_BLOCK"
  | "UNSUPPORTED_SECTION"
  | "TITLE_MISMATCH"
  | "UNKNOWN_PROFILE";

export type ParseIssue = {
  code: ParseIssueCode;
  file: string;
  section?: string;
  startLine: number;
  endLine: number;
  message: string;
  snippet?: string;
  severity: "error" | "warning";
};

export type ParseResult<T> = {
  value: T | null;
  issues: ParseIssue[];
};
