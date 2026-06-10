#!/usr/bin/env node

import { loadCatalogFromRoot } from "./core/load-catalog.js";
import { registerGenerator } from "./generators/engine.js";
import { TypeScriptGenerator } from "./generators/typescript/index.js";
import { PythonGenerator } from "./generators/python/index.js";
import { GoGenerator } from "./generators/go/index.js";
import { RustGenerator } from "./generators/rust/index.js";
import { JavaGenerator } from "./generators/java/index.js";
import { parseArguments } from "./utils/args.js";
import { printHelp } from "./cli/help.js";
import { checkErrors } from "./cli/commands.js";
import {
  handleList, handleInspect, handleGraph, handleSearch,
  handleResolve, handleAdapters, handleGenerate,
  handlePrototype, handleSchema, handleBuild, handleVerify, handleImplement,
} from "./cli/commands.js";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve as pathResolve, join } from "node:path";

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

function verifyCatalogHash(): void {
  const pkgDir = pathResolve(__dirname, "..");
  const pkgPath = join(pkgDir, "package.json");
  const minCatalogPath = join(pkgDir, "dist", "catalog.min.json");
  if (!existsSync(minCatalogPath)) return;

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const expectedHash = pkg.blueprint?.catalogHash;
    if (!expectedHash) return;

    const catalog = readFileSync(minCatalogPath, "utf8");
    const actualHash = createHash("sha256").update(catalog).digest("hex");

    if (actualHash !== expectedHash) {
      console.error("Catalog integrity check failed.");
      console.error("  Expected: " + expectedHash);
      console.error("  Actual:   " + actualHash);
      console.error("The catalog has been modified or corrupted. Reinstall the package to fix.");
      process.exit(1);
    }
  } catch {
    // If we can't verify, proceed (e.g. running from source during development)
  }
}

async function main() {
  verifyCatalogHash();
  registerGenerator(new TypeScriptGenerator());
  registerGenerator(new PythonGenerator());
  registerGenerator(new GoGenerator());
  registerGenerator(new RustGenerator());
  registerGenerator(new JavaGenerator());

  const args = parseArguments(process.argv.slice(2));

  if (args.unknown.length > 0) {
    args.unknown.forEach((flag) => console.error(`Unknown option: ${flag}`));
    process.exit(1);
  }

  if (args.help) { printHelp(args.command); return; }
  if (args.version) { console.log(`@friehub/blueprint@${getVersion()}`); return; }

  const userRoot = args.root ?? process.cwd();
  const pkgRoot = pathResolve(__dirname, "..");
  const root = existsSync(join(pkgRoot, "dist", "catalog.min.json")) ? pkgRoot : userRoot;
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
    verify: handleVerify,
    implement: handleImplement,
    build: handleBuild,
  };

  if (args.command === "mcp") {
    await import("./mcp/server.js");
    return;
  }

  const handler = handlers[args.command] ?? handleBuild;
  await handler(result, args, root);
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
