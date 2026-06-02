#!/usr/bin/env node

import { loadCatalogFromRoot } from "./core/load-catalog.js";
import { registerGenerator } from "./generators/engine.js";
import { TypeScriptGenerator } from "./generators/typescript/index.js";
import { parseArguments } from "./utils/args.js";
import { printHelp } from "./cli/help.js";
import { checkErrors } from "./cli/commands.js";
import {
  handleList, handleInspect, handleGraph, handleSearch,
  handleResolve, handleAdapters, handleGenerate,
  handlePrototype, handleSchema, handleBuild,
} from "./cli/commands.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve as pathResolve } from "node:path";

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

async function main() {
  registerGenerator(new TypeScriptGenerator());

  const args = parseArguments(process.argv.slice(2));

  if (args.unknown.length > 0) {
    args.unknown.forEach((flag) => console.error(`Unknown option: ${flag}`));
    process.exit(1);
  }

  if (args.help) { printHelp(args.command); return; }
  if (args.version) { console.log(`engineering-blueprinter@${getVersion()}`); return; }

  const root = args.root ?? process.cwd();
  const result = await loadCatalogFromRoot(root, args.strict ? "strict" : "loose");
  checkErrors(result, args.strict ?? false, args.quiet ?? false);
  if (!result.value) { console.error("Failed to load catalog."); process.exit(1); }

  const handlers: Record<string, (r: typeof result, a: typeof args, rt: string) => Promise<void>> = {
    list: handleList,
    inspect: handleInspect,
    graph: handleGraph,
    search: handleSearch,
    resolve: handleResolve,
    adapters: handleAdapters,
    generate: handleGenerate,
    prototype: handlePrototype,
    schema: handleSchema,
    build: handleBuild,
  };

  const handler = handlers[args.command] ?? handleBuild;
  await handler(result, args, root);
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
