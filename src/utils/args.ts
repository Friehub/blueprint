export type Command = "build" | "resolve" | "list" | "inspect" | "graph" | "search" | "adapters" | "generate" | "prototype" | "schema" | "verify" | "implement" | "mcp";
export type AdapterSubcommand = "list" | "add" | "remove" | "show" | "verify" | "search";
export type GenerateSubcommand = "interfaces" | "adapters" | "tests" | "all";
export type Language = "typescript" | "rust" | "python" | "go" | "java";
export type OutputFormat = "ascii" | "mermaid";

export interface ParsedArgs {
  command: Command;
  adapterSubcommand: AdapterSubcommand | undefined;
  generateSubcommand: GenerateSubcommand | undefined;
  root: string | undefined;
  strict: boolean | undefined;
  strictVersion: boolean | undefined;
  help: boolean | undefined;
  version: boolean | undefined;
  output: string | undefined;
  modules: string[];
  target: string | undefined;
  query: string | undefined;
  provider: string | undefined;
  module: string | undefined;
  language: Language | undefined;
  format: OutputFormat;
  compact: boolean;
  quiet: boolean;
  minimal: boolean;
  prompts: boolean;
  namespace?: string;
  aliases?: string;
  obfuscate?: string;
  unknown: string[];
}

const KNOWN_FLAGS = new Set(["--root", "--strict", "--help", "-h", "--version", "-v", "--output", "--modules", "--format", "--compact", "--quiet", "--module", "--lang", "--name", "--minimal", "--prompts", "--adapter", "--namespace", "--aliases", "--obfuscate", "--strict-version", "--auth-token"]);
const COMMANDS = new Set(["build", "resolve", "list", "inspect", "graph", "search", "adapters", "generate", "prototype", "schema", "verify", "implement", "mcp"]);
const ADAPTER_SUBCOMMANDS = new Set(["list", "add", "remove", "show", "verify", "search"]);
const GENERATE_SUBCOMMANDS = new Set(["interfaces", "adapters", "tests", "all"]);
const LANGUAGES = new Set(["typescript", "rust", "python", "go", "java"]);

export function parseArguments(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    command: "build",
    adapterSubcommand: undefined,
    generateSubcommand: undefined,
    root: undefined,
    strict: undefined,
    strictVersion: undefined,
    help: undefined,
    version: undefined,
    output: undefined,
    modules: [],
    target: undefined,
    query: undefined,
    provider: undefined,
    module: undefined,
    language: undefined,
    format: "ascii",
    compact: false,
    quiet: false,
    minimal: false,
    prompts: false,
    unknown: [],
  };

  let i = 0;

  if (i < args.length && !args[i]!.startsWith("-") && COMMANDS.has(args[i]!)) {
    parsed.command = args[i]! as ParsedArgs["command"];
    i++;
  }

  if (parsed.command === "adapters" && i < args.length && !args[i]!.startsWith("-") && ADAPTER_SUBCOMMANDS.has(args[i]!)) {
    parsed.adapterSubcommand = args[i]! as AdapterSubcommand;
    i++;
  }

  if (parsed.command === "generate" && i < args.length && !args[i]!.startsWith("-") && GENERATE_SUBCOMMANDS.has(args[i]!)) {
    parsed.generateSubcommand = args[i]! as GenerateSubcommand;
    i++;
  }

  if (parsed.command === "adapters" && parsed.adapterSubcommand === "add" && i < args.length && !args[i]!.startsWith("-")) {
    parsed.provider = args[i];
    i++;
    if (i < args.length && !args[i]!.startsWith("-")) {
      parsed.module = args[i];
      i++;
    }
  }

  if (parsed.command === "adapters" && parsed.adapterSubcommand === "remove" && i < args.length && !args[i]!.startsWith("-")) {
    parsed.module = args[i];
    i++;
  }

  if (parsed.command === "adapters" && (parsed.adapterSubcommand === "list" || parsed.adapterSubcommand === "verify" || parsed.adapterSubcommand === "search") && i < args.length && !args[i]!.startsWith("-")) {
    parsed.query = args[i];
    i++;
  }

  if (parsed.command === "generate" && i < args.length && !args[i]!.startsWith("-")) {
    parsed.provider = args[i];
    i++;
    if (i < args.length && !args[i]!.startsWith("-")) {
      parsed.module = args[i];
      i++;
    }
  }

  if ((parsed.command === "inspect" || parsed.command === "graph") && i < args.length && !args[i]!.startsWith("-")) {
    parsed.target = args[i];
    i++;
  }

  if (parsed.command === "verify" && i < args.length && !args[i]!.startsWith("-")) {
    parsed.target = args[i];
    i++;
  }

  if (parsed.command === "search" && i < args.length && !args[i]!.startsWith("-")) {
    parsed.query = args[i];
    i++;
  }

  for (; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--root" && i + 1 < args.length) {
      parsed.root = args[++i];
    } else if (arg === "--strict") {
      parsed.strict = true;
    } else if (arg === "--strict-version") {
      parsed.strictVersion = true;
    } else if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--version" || arg === "-v") {
      parsed.version = true;
    } else if (arg === "--output" && i + 1 < args.length) {
      parsed.output = args[++i];
    } else if (arg === "--modules" && i + 1 < args.length) {
      parsed.modules = (args[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    } else if (arg === "--module" && i + 1 < args.length) {
      parsed.module = args[++i];
    } else if (arg === "--lang" && i + 1 < args.length) {
      const lang = args[++i] ?? "";
      if (LANGUAGES.has(lang)) {
        parsed.language = lang as Language;
      } else {
        parsed.unknown.push(arg);
      }
    } else if (arg === "--format" && i + 1 < args.length) {
      const fmt = args[++i];
      if (fmt === "ascii" || fmt === "mermaid") {
        parsed.format = fmt;
      } else {
        parsed.unknown.push(arg);
      }
    } else if (arg === "--compact") {
      parsed.compact = true;
    } else if (arg === "--quiet") {
      parsed.quiet = true;
    } else if (arg === "--minimal") {
      parsed.minimal = true;
    } else if (arg === "--prompts") {
      parsed.prompts = true;
    } else if (arg === "--adapter" && i + 1 < args.length) {
      parsed.provider = args[++i];
    } else if (arg === "--name" && i + 1 < args.length) {
      parsed.target = args[++i];
    } else if (arg === "--namespace" && i + 1 < args.length) {
      parsed.namespace = args[++i];
    } else if (arg === "--aliases" && i + 1 < args.length) {
      parsed.aliases = args[++i];
    } else if (arg === "--obfuscate" && i + 1 < args.length) {
      parsed.obfuscate = args[++i];
    } else if (arg.startsWith("-") && !KNOWN_FLAGS.has(arg)) {
      parsed.unknown.push(arg);
    }
  }

  return parsed;
}
