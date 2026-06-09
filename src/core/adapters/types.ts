export type AdapterConfigField = {
  name: string;
  type: "string" | "number" | "boolean" | "object";
  description?: string;
  default?: string | number | boolean;
  secret?: boolean;
};

export type AdapterConfig = {
  required: AdapterConfigField[];
  optional: AdapterConfigField[];
};

export type AdapterDependency = {
  module: string;
  purpose: string;
  required: boolean;
};

export type AdapterMetadata = {
  provider_url?: string;
  docs_url?: string;
  supported_regions?: string[];
  supported_currencies?: string[];
};

export type AdapterDefinition = {
  name: string;
  module: string;
  version: string;
  description?: string;
  implements: string[];
  does_not_implement?: string[];
  config: AdapterConfig;
  dependencies?: AdapterDependency[];
  metadata?: AdapterMetadata;
  languages?: string[];
};

export type AdapterSelection = {
  primary: string;
  fallback?: string;
};

export type UserSelection = {
  adapters: Record<string, string | AdapterSelection>;
};

export type AdapterIssue = {
  adapter: string;
  module: string;
  message: string;
  severity: "error" | "warning";
};

export type AdapterResolution = {
  selected: Record<string, string>;
  fallbacks: Record<string, string>;
  issues: AdapterIssue[];
};

export function adapterSupportsLanguage(adapter: AdapterDefinition, language: string): boolean {
  if (!adapter.languages || adapter.languages.length === 0) return true;
  return adapter.languages.includes(language);
}
