export type Command = "build" | "resolve" | "list" | "inspect" | "graph";
export type OutputFormat = "ascii" | "mermaid";

export interface ParsedArgs {
  command: Command;
  root: string | undefined;
  strict: boolean | undefined;
  help: boolean | undefined;
  version: boolean | undefined;
  output: string | undefined;
  modules: string[];
  target: string | undefined;
  format: OutputFormat;
  compact: boolean;
  quiet: boolean;
  unknown: string[];
}

const KNOWN_FLAGS = new Set(["--root", "--strict", "--help", "-h", "--version", "-v", "--output", "--modules", "--format", "--compact", "--quiet"]);
const COMMANDS = new Set(["build", "resolve", "list", "inspect", "graph"]);

export function parseArguments(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    command: "build",
    root: undefined,
    strict: undefined,
    help: undefined,
    version: undefined,
    output: undefined,
    modules: [],
    target: undefined,
    format: "ascii",
    compact: false,
    quiet: false,
    unknown: [],
  };

  let i = 0;

  if (i < args.length && !args[i]!.startsWith("-") && COMMANDS.has(args[i]!)) {
    parsed.command = args[i]! as ParsedArgs["command"];
    i++;
  }

  if ((parsed.command === "inspect" || parsed.command === "graph") && i < args.length && !args[i]!.startsWith("-")) {
    parsed.target = args[i];
    i++;
  }

  for (; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--root" && i + 1 < args.length) {
      parsed.root = args[++i];
    } else if (arg === "--strict") {
      parsed.strict = true;
    } else if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--version" || arg === "-v") {
      parsed.version = true;
    } else if (arg === "--output" && i + 1 < args.length) {
      parsed.output = args[++i];
    } else if (arg === "--modules" && i + 1 < args.length) {
      parsed.modules = (args[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
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
    } else if (arg.startsWith("-") && !KNOWN_FLAGS.has(arg)) {
      parsed.unknown.push(arg);
    }
  }

  return parsed;
}
