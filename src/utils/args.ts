export interface ParsedArgs {
  root: string | undefined;
  strict: boolean | undefined;
  help: boolean | undefined;
  version: boolean | undefined;
  output: string | undefined;
}

export function parseArguments(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    root: undefined,
    strict: undefined,
    help: undefined,
    version: undefined,
    output: undefined,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--root' && i + 1 < args.length) {
      parsed.root = args[++i];
    } else if (arg === '--strict') {
      parsed.strict = true;
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--version' || arg === '-v') {
      parsed.version = true;
    } else if (arg === '--output' && i + 1 < args.length) {
      parsed.output = args[++i];
    }
    // Ignore unknown arguments for now
  }

  return parsed;
}