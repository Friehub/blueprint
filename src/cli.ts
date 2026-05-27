#!/usr/bin/env node

import { loadCatalogFromRoot } from "./core/load-catalog.js";
import { resolve, detectCycles } from "./core/resolve.js";
import { buildGraph, renderAscii, renderMermaid } from "./core/graph.js";
import { parseArguments } from "./utils/args.js";
import { writeFile, stat } from "node:fs/promises";
import { dirname, resolve as pathResolve } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", reject);
  });
}

function parseStdinModules(input: string): string[] {
  return input
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
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
    if (resolved.warnings.length > 0 && !quiet) {
      for (const warning of resolved.warnings) {
        console.warn(`  - ${warning}`);
      }
    }
    outputData = JSON.stringify(resolved, null, compact ? undefined : 2);
  } else {
    outputData = JSON.stringify(result.value, null, compact ? undefined : 2);
  }

  if (output) {
    try {
      await stat(dirname(output));
    } catch {
      console.error(`Error: output directory does not exist: ${dirname(output)}`);
      process.exit(1);
    }
    await writeFile(output, outputData, "utf8");
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
    const summary = mod.summary ? ` — ${mod.summary}` : "";
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

  console.log(`
Usage: blueprinter [command] [options]

Commands:
  build (default)    Load all contracts and output catalog.json
  list               List all modules with dependencies
  inspect <module>   Show full contract for a module
  graph <module>     Show dependency graph for a module
  resolve            Resolve specific modules with dependencies

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
