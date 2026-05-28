#!/usr/bin/env node

import { loadCatalogFromRoot } from "./core/load-catalog.js";
import { resolve, detectCycles } from "./core/resolve.js";
import { buildGraph, renderAscii, renderMermaid } from "./core/graph.js";
import { searchModules } from "./core/search.js";
import { loadAdapters, loadSelection, addAdapter, removeAdapter, resolveAdapters, listAdaptersByModule } from "./core/adapters/index.js";
import { registerGenerator, generateAndWrite, getAvailableLanguages } from "./generators/engine.js";
import { TypeScriptGenerator } from "./generators/typescript/index.js";
import { generatePrototype } from "./generators/prototype/index.js";
import { parseArguments } from "./utils/args.js";
import { writeFile, stat, mkdir } from "node:fs/promises";
import { dirname, join, resolve as pathResolve } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as readline from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    const pkgPath = pathResolve(__dirname, "../package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

async function readStdin(): Promise<string> {
  if (process.stdin.destroyed || process.stdin.readableEnded) {
    return "";
  }
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", () => resolve(""));
    process.stdin.resume();
  });
}

function parseStdinModules(input: string): string[] {
  return input
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function interactivePicker(query: string, results: Array<{ module: { name: string; summary: string | null } }>): Promise<string[]> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  console.log(`\nFound ${results.length} modules matching "${query}":\n`);

  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    const summary = r.module.summary ? ` - ${r.module.summary}` : "";
    console.log(`  ${i + 1}. ${r.module.name}${summary}`);
  }

  console.log("\nEnter numbers separated by commas (e.g., 1,3,5), or 'all' to select all:");

  const answer = await question("> ");
  rl.close();

  const trimmed = answer.trim().toLowerCase();

  if (trimmed === "all") {
    return results.map((r) => r.module.name);
  }

  const indices = trimmed
    .split(",")
    .map((s) => parseInt(s.trim(), 10) - 1)
    .filter((i) => i >= 0 && i < results.length);

  return indices.map((i) => results[i]!.module.name);
}

async function main() {
  registerGenerator(new TypeScriptGenerator());

  const args = parseArguments(process.argv.slice(2));

  if (args.unknown.length > 0) {
    for (const flag of args.unknown) {
      console.error(`Unknown option: ${flag}`);
    }
    process.exit(1);
  }

  if (args.help) {
    printHelp(args.command);
    return;
  }
  if (args.version) {
    console.log(`engineering-blueprinter@${getVersion()}`);
    return;
  }

  const root = args.root ?? process.cwd();
  const strict = args.strict ?? false;
  const quiet = args.quiet ?? false;
  const output = args.output;
  const compact = args.compact ?? false;

  const result = await loadCatalogFromRoot(root, strict ? "strict" : "loose");

  if (result.issues.length > 0) {
    const errors = result.issues.filter((issue) => issue.severity === "error");
    const warnings = result.issues.filter((issue) => issue.severity === "warning");
    if (errors.length > 0) {
      console.error("Errors encountered while loading the catalog:");
      for (const error of errors) {
        console.error(`  - ${error.message}`);
      }
      if (strict) {
        process.exit(1);
      } else {
        process.exitCode = 1;
      }
    }
    if (warnings.length > 0 && !quiet) {
      console.warn("Warnings encountered while loading the catalog:");
      for (const warning of warnings) {
        console.warn(`  - ${warning.message}`);
      }
    }
  }

  if (!result.value) {
    console.error("Failed to load catalog.");
    process.exit(1);
  }

  let outputData: string;

  if (args.command === "list") {
    outputData = renderList(result.value);
  } else if (args.command === "inspect") {
    if (!args.target) {
      console.error("Error: module name is required for inspect command.");
      console.error("Example: blueprinter inspect billing");
      process.exit(1);
    }
    const mod = result.value.modules.find((m) => m.name === args.target);
    if (!mod) {
      console.error(`Module not found: ${args.target}`);
      process.exit(1);
    }
    outputData = JSON.stringify(mod, null, compact ? undefined : 2);
  } else if (args.command === "graph") {
    if (!args.target) {
      console.error("Error: module name is required for graph command.");
      console.error("Example: blueprinter graph billing");
      process.exit(1);
    }
    const graph = buildGraph(result.value, args.target);
    if (graph.nodes.length === 0) {
      console.error(`Module not found: ${args.target}`);
      process.exit(1);
    }
    outputData = args.format === "mermaid"
      ? renderMermaid(graph, args.target)
      : renderAscii(graph, args.target);
  } else if (args.command === "search") {
    let query = args.query;

    if (!query && !process.stdin.isTTY) {
      const input = await readStdin();
      query = input.trim().split("\n")[0]?.trim();
    }

    if (!query) {
      console.error("Error: search query is required.");
      console.error("Example: blueprinter search billing");
      process.exit(1);
    }

    const results = searchModules(result.value, query);
    if (results.length === 0) {
      console.error(`No modules found matching "${query}"`);
      process.exit(1);
    }

    if (process.stdin.isTTY) {
      const selected = await interactivePicker(query, results);
      if (selected.length === 0) {
        console.error("No modules selected.");
        process.exit(1);
      }

      const cycles = detectCycles(result.value);
      if (cycles.length > 0) {
        console.error("Cycle detected in hard dependencies:");
        for (const cycle of cycles) {
          console.error(`  ${cycle.join(" → ")}`);
        }
        process.exit(1);
      }

      const resolved = resolve(result.value, selected);
      if (resolved.errors.length > 0) {
        console.error("Resolve errors:");
        for (const error of resolved.errors) {
          console.error(`  - ${error}`);
        }
        process.exit(1);
      }
      outputData = JSON.stringify(resolved, null, compact ? undefined : 2);
    } else {
      const names = results.map((r) => r.module.name);
      outputData = JSON.stringify(names, null, compact ? undefined : 2);
    }
  } else if (args.command === "resolve") {
    let modules = args.modules;

    if (modules.length === 0 && !process.stdin.isTTY) {
      const input = await readStdin();
      modules = parseStdinModules(input);
    }

    if (modules.length === 0) {
      console.error("Error: --modules is required for resolve command.");
      console.error("Example: blueprinter resolve --modules billing,payments,users");
      console.error("       echo billing,payments | blueprinter resolve");
      process.exit(1);
    }

    const cycles = detectCycles(result.value);
    if (cycles.length > 0) {
      console.error("Cycle detected in hard dependencies:");
      for (const cycle of cycles) {
        console.error(`  ${cycle.join(" → ")}`);
      }
      process.exit(1);
    }

    const resolved = resolve(result.value, modules);
    if (resolved.errors.length > 0) {
      console.error("Resolve errors:");
      for (const error of resolved.errors) {
        console.error(`  - ${error}`);
      }
      process.exit(1);
    }
    if (resolved.warnings.length > 0 && !quiet) {
      for (const warning of resolved.warnings) {
        console.warn(`  - ${warning}`);
      }
    }
    outputData = JSON.stringify(resolved, null, compact ? undefined : 2);
  } else if (args.command === "adapters") {
    const adaptersDir = join(root, "adapters");
    const { adapters, errors: loadErrors } = await loadAdapters(adaptersDir);

    if (loadErrors.length > 0 && !quiet) {
      for (const error of loadErrors) {
        console.warn(`  - ${error}`);
      }
    }

    if (args.adapterSubcommand === "list") {
      const byModule = listAdaptersByModule(adapters);
      outputData = renderAdapterList(byModule, args.query);
    } else if (args.adapterSubcommand === "add") {
      if (!args.provider || !args.module) {
        console.error("Error: provider and module are required.");
        console.error("Example: blueprinter adapters add stripe payments");
        process.exit(1);
      }
      const { selection, error } = await addAdapter(root, args.module, args.provider);
      if (error) {
        console.error(`Error: ${error}`);
        process.exit(1);
      }
      console.log(`Added ${args.provider} as adapter for ${args.module}`);
      outputData = JSON.stringify(selection, null, compact ? undefined : 2);
    } else if (args.adapterSubcommand === "remove") {
      if (!args.module) {
        console.error("Error: module is required.");
        console.error("Example: blueprinter adapters remove payments");
        process.exit(1);
      }
      const { selection, error } = await removeAdapter(root, args.module);
      if (error) {
        console.error(`Error: ${error}`);
        process.exit(1);
      }
      console.log(`Removed adapter for ${args.module}`);
      outputData = JSON.stringify(selection, null, compact ? undefined : 2);
    } else if (args.adapterSubcommand === "show") {
      const { selection } = await loadSelection(root);
      outputData = JSON.stringify(selection, null, compact ? undefined : 2);
    } else if (args.adapterSubcommand === "verify") {
      const { selection } = await loadSelection(root);
      const resolution = resolveAdapters(selection, adapters, result.value);
      if (resolution.issues.length > 0) {
        for (const issue of resolution.issues) {
          if (issue.severity === "error") {
            console.error(`  ERROR: ${issue.adapter ? `${issue.adapter} → ` : ""}${issue.module}: ${issue.message}`);
          } else if (!quiet) {
            console.warn(`  WARN: ${issue.adapter ? `${issue.adapter} → ` : ""}${issue.module}: ${issue.message}`);
          }
        }
        const hasErrors = resolution.issues.some((i) => i.severity === "error");
        if (hasErrors) {
          process.exit(1);
        }
      } else {
        console.log("All adapters verified successfully.");
      }
      outputData = JSON.stringify(resolution, null, compact ? undefined : 2);
    } else if (args.adapterSubcommand === "search") {
      const query = args.query ?? "";
      const results = adapters.filter(
        (a) => a.name.includes(query) || a.module.includes(query) || a.description?.includes(query),
      );
      outputData = JSON.stringify(results, null, compact ? undefined : 2);
    } else {
      console.error("Error: adapter subcommand is required.");
      console.error("Available subcommands: list, add, remove, show, verify, search");
      process.exit(1);
    }
  } else if (args.command === "generate") {
    const language = args.language ?? "typescript";
    const type = args.generateSubcommand ?? "all";
    const outputDir = args.output ?? join(root, "generated");

    const adaptersDir = join(root, "adapters");
    const { adapters } = await loadAdapters(adaptersDir);

    const { written, errors } = await generateAndWrite(
      result.value,
      adapters,
      {
        language,
        type,
        module: args.module,
        provider: args.provider,
        outputDir,
      },
    );

    if (errors.length > 0) {
      console.error("Generation errors:");
      for (const error of errors) {
        console.error(`  - ${error}`);
      }
    }

    console.log(`Generated ${written} files to ${outputDir}`);
    outputData = "";
  } else if (args.command === "prototype") {
    const { selection } = await loadSelection(root);
    const adaptersDir = join(root, "adapters");
    const { adapters } = await loadAdapters(adaptersDir);

    const selectedAdapters: Record<string, string> = {};
    for (const [module, adapterRef] of Object.entries(selection.adapters)) {
      if (typeof adapterRef === "string") {
        selectedAdapters[module] = adapterRef;
      } else {
        selectedAdapters[module] = adapterRef.primary;
      }
    }

    if (Object.keys(selectedAdapters).length === 0) {
      console.error("Error: No adapters selected. Use 'blueprinter adapters add' first.");
      process.exit(1);
    }

    const moduleName = args.target ?? "my-project";
    const outputDir = args.output ?? join(root, moduleName);

    const { files, errors } = generatePrototype(
      result.value,
      adapters,
      {
        name: moduleName,
        modules: Object.keys(selectedAdapters),
        adapters: selectedAdapters,
        outputDir,
      },
    );

    if (errors.length > 0) {
      console.error("Prototype generation errors:");
      for (const error of errors) {
        console.error(`  - ${error}`);
      }
    }

    for (const file of files) {
      try {
        const fullPath = join(outputDir, file.path);
        await mkdir(dirname(fullPath), { recursive: true });
        await writeFile(fullPath, file.content, "utf8");
      } catch (error) {
        console.error(`Failed to write ${file.path}: ${error instanceof Error ? error.message : error}`);
      }
    }

    console.log(`Generated prototype with ${files.length} files to ${outputDir}`);
    outputData = "";
  } else {
    if (process.exitCode) {
      console.error("Catalog has errors. Use --strict to fail on errors, or fix the issues above.");
      process.exit(1);
    }
    outputData = JSON.stringify(result.value, null, compact ? undefined : 2);
  }

  if (output) {
    try {
      await stat(dirname(output));
    } catch {
      console.error(`Error: output directory does not exist: ${dirname(output)}`);
      process.exit(1);
    }
    try {
      await writeFile(output, outputData, "utf8");
    } catch (error) {
      console.error(`Error: could not write to ${output}: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  } else {
    console.log(outputData);
  }
}

function renderList(catalog: { modules: Array<{ name: string; hardDeps: string[]; softDeps: string[]; coreInherits: string[]; summary: string | null }>; core: Array<{ name: string; implicit: boolean }> }): string {
  const lines: string[] = [];

  lines.push("Modules:");
  for (const mod of catalog.modules.sort((a, b) => a.name.localeCompare(b.name))) {
    const deps = mod.hardDeps.length > 0 ? mod.hardDeps.join(", ") : "(none)";
    const soft = mod.softDeps.length > 0 ? mod.softDeps.join(", ") : "(none)";
    const coreInherits = mod.coreInherits.length > 0 ? mod.coreInherits.join(", ") : "(none)";
    const summary = mod.summary ? ` - ${mod.summary}` : "";
    lines.push(`  ${mod.name}${summary}`);
    lines.push(`    deps: ${deps}`);
    lines.push(`    recommends: ${soft}`);
    lines.push(`    inherits: ${coreInherits}`);
  }

  lines.push("");
  lines.push("Core contracts:");
  for (const c of catalog.core.sort((a, b) => a.name.localeCompare(b.name))) {
    lines.push(`  ${c.name}${c.implicit ? " (implicit)" : ""}`);
  }

  return lines.join("\n");
}

function renderAdapterList(byModule: Record<string, string[]>, filter?: string): string {
  const lines: string[] = [];
  const modules = Object.keys(byModule).sort();

  lines.push("Available adapters:");
  lines.push("");

  for (const module of modules) {
    if (filter && !module.includes(filter)) {
      continue;
    }
    const adapters = byModule[module]!;
    lines.push(`  ${module}`);
    for (const adapter of adapters) {
      lines.push(`    - ${adapter}`);
    }
  }

  return lines.join("\n");
}

function printHelp(command?: string) {
  if (command === "resolve") {
    console.log(`
Usage: blueprinter resolve [options]

Options:
  --modules <list>   Comma-separated module names to resolve
  --root <path>      Project root directory (default: current directory)
  --output <file>    Write the resolved set to this file instead of stdout
  --compact          Output compact JSON (no indentation)
  --quiet            Suppress warnings

Reads module names from stdin if --modules is not provided.
Examples:
  blueprinter resolve --modules billing,payments,users
  echo billing,payments | blueprinter resolve
  cat modules.txt | blueprinter resolve --output resolved.json
`);
    return;
  }

  if (command === "inspect") {
    console.log(`
Usage: blueprinter inspect <module> [options]

Options:
  --root <path>      Project root directory (default: current directory)
  --output <file>    Write the contract to this file instead of stdout
  --compact          Output compact JSON (no indentation)

Shows the full contract for a single module.
`);
    return;
  }

  if (command === "graph") {
    console.log(`
Usage: blueprinter graph <module> [options]

Options:
  --format <fmt>     Output format: ascii (default) or mermaid
  --root <path>      Project root directory (default: current directory)
  --output <file>    Write the graph to this file instead of stdout

Shows the dependency graph for a module.
`);
    return;
  }

  if (command === "search") {
    console.log(`
Usage: blueprinter search <query> [options]

Options:
  --root <path>      Project root directory (default: current directory)
  --output <file>    Write the resolved set to this file instead of stdout
  --compact          Output compact JSON (no indentation)

Searches for modules matching the query and interactively picks which to resolve.
In non-interactive mode (piped input), outputs matching module names as JSON.
Examples:
  blueprinter search billing
  blueprinter search "user management"
  echo "payment" | blueprinter search
`);
    return;
  }

  if (command === "adapters") {
    console.log(`
Usage: blueprinter adapters <subcommand> [options]

Subcommands:
  list [module]         List available adapters
  add <provider> <module>  Select an adapter for a module
  remove <module>       Remove adapter selection
  show                  Show current adapter selections
  verify [module]       Verify adapters against contracts
  search <query>        Search for adapters

Options:
  --root <path>         Project root directory (default: current directory)
  --compact             Output compact JSON (no indentation)
  --quiet               Suppress warnings

Examples:
  blueprinter adapters list
  blueprinter adapters list payments
  blueprinter adapters add stripe payments
  blueprinter adapters remove payments
  blueprinter adapters show
  blueprinter adapters verify
  blueprinter adapters search stripe
`);
    return;
  }

  if (command === "generate") {
    console.log(`
Usage: blueprinter generate [subcommand] [options]

Subcommands:
  interfaces            Generate language interfaces from contracts
  adapters              Generate adapter skeletons
  tests                 Generate conformance tests
  all                   Generate all (default)

Options:
  --lang <language>     Target language: typescript (default), rust, python, go
  --module <module>     Generate for specific module only
  --output <dir>        Output directory (default: ./generated)
  --root <path>         Project root directory (default: current directory)

Examples:
  blueprinter generate
  blueprinter generate --lang typescript
  blueprinter generate interfaces --lang typescript
  blueprinter generate adapter stripe payments --lang typescript
  blueprinter generate tests --lang typescript
  blueprinter generate --module billing --lang typescript
`);
    return;
  }

  if (command === "prototype") {
    console.log(`
Usage: blueprinter prototype [options]

Options:
  --name <name>         Project name (default: my-project)
  --output <dir>        Output directory (default: ./<name>)
  --root <path>         Project root directory (default: current directory)

Generates a project scaffold based on selected adapters.
Requires adapters to be selected first with 'blueprinter adapters add'.

Examples:
  blueprinter prototype
  blueprinter prototype --name my-saas
  blueprinter prototype --output ./my-project
`);
    return;
  }

  console.log(`
Usage: blueprinter [command] [options]

Commands:
  build (default)    Load all contracts and output catalog.json
  list               List all modules with dependencies
  search <query>     Search for modules and interactively pick to resolve
  inspect <module>   Show full contract for a module
  graph <module>     Show dependency graph for a module
  resolve            Resolve specific modules with dependencies
  adapters           Manage adapter selections
  generate           Generate code from contracts
  prototype          Generate project scaffold

Options:
  --root <path>      Project root directory (default: current directory)
  --strict           Exit with code 1 if there are any errors (warnings do not affect exit code)
  --output <file>    Write output to this file instead of stdout
  --modules <list>   Comma-separated module names (resolve command only)
  --format <fmt>     Output format for graph: ascii (default) or mermaid
  --compact          Output compact JSON (no indentation)
  --quiet            Suppress warnings
  --help, -h         Show this help message
  --version, -v      Show version number

Examples:
  blueprinter list
  blueprinter search billing
  blueprinter inspect billing
  blueprinter graph billing
  blueprinter graph billing --format mermaid
  blueprinter resolve --modules billing,payments,users
  blueprinter resolve --modules billing,payments,users --output resolved.json
  echo billing,payments | blueprinter resolve --compact
`);
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
