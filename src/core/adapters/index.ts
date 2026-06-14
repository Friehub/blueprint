export type {
  AdapterDefinition,
  AdapterConfig,
  AdapterConfigField,
  AdapterDependency,
  AdapterMetadata,
  AdapterSelection,
  UserSelection,
  AdapterIssue,
  AdapterResolution,
} from "./types.js";

export { adapterSupportsLanguage } from "./types.js";
export { loadAdapters, loadAdapter } from "./load.js";
export { validateAdapter, validateAdapterSelection } from "./validate.js";
export { loadSelection, saveSelection, addAdapter, removeAdapter, getAdapterForModule, getPrimaryAdapter } from "./select.js";
export { resolveAdapters, listAdaptersByModule, findAdapter } from "./resolve.js";
