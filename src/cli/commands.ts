import { resolve, detectCycles } from "../core/resolve.js";
import { buildGraph, renderAscii, renderMermaid } from "../core/graph.js";
import { searchModules } from "../core/search.js";
import { verifyImplementation } from "../core/verify.js";
import { generateImplementPrompts } from "../core/implement.js";
import { loadAdapters, loadSelection, addAdapter, removeAdapter, resolveAdapters, listAdaptersByModule } from "../core/adapters/index.js";
import { generateAndWrite } from "../generators/engine.js";
import { generatePrototype } from "../generators/prototype/index.js";
import { renderList, renderAdapterList, minimalCatalog, generateJsonSchema } from "./render.js";
import { writeFile, stat, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import * as readline from "node:readline";
import type { ParsedArgs } from "../utils/args.js";
import type { Catalog } from "../core/catalog.js";

async function readStdin(): Promise<string> {
  if (process.stdin.destroyed || process.stdin.readableEnded) return "";
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", () => resolve(""));
    process.stdin.resume();
  });
}

function parseStdinModules(input: string): string[] {
  return input.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
}

async function interactivePicker(query: string, results: Array<{ module: { name: string; summary: string | null } }>): Promise<string[]> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = (prompt: string): Promise<string> => new Promise((resolve) => rl.question(prompt, resolve));

  console.log(`\nFound ${results.length} modules matching "${query}":\n`);
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    console.log(`  ${i + 1}. ${r.module.name}${r.module.summary ? ` - ${r.module.summary}` : ""}`);
  }
  console.log("\nEnter numbers (e.g., 1,3,5), or 'all':");
  const answer = await question("> ");
  rl.close();

  const trimmed = answer.trim().toLowerCase();
  if (trimmed === "all") return results.map((r) => r.module.name);

  return trimmed.split(",").map((s) => parseInt(s.trim(), 10) - 1)
    .filter((i) => i >= 0 && i < results.length)
    .map((i) => results[i]!.module.name);
}

async function writeOutput(outputData: string, outputPath?: string) {
  if (!outputPath) {
    console.log(outputData);
    return;
  }
  try {
    await stat(dirname(outputPath));
  } catch {
    console.error(`Error: output directory does not exist: ${dirname(outputPath)}`);
    process.exit(1);
  }
  try {
    await writeFile(outputPath, outputData, "utf8");
  } catch (error) {
    console.error(`Error: could not write to ${outputPath}: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export function checkErrors(result: { issues: Array<{ severity: string; message: string }> }, strict: boolean, quiet: boolean) {
  if (result.issues.length === 0) return;
  const errors = result.issues.filter((i) => i.severity === "error");
  const warnings = result.issues.filter((i) => i.severity === "warning");
  if (errors.length > 0) {
    console.error("Errors:");
    errors.forEach((e) => console.error(`  - ${e.message}`));
    if (strict) process.exit(1);
    else process.exitCode = 1;
  }
  if (warnings.length > 0 && !quiet) {
    console.warn("Warnings:");
    warnings.forEach((w) => console.warn(`  - ${w.message}`));
  }
}

export async function handleList(result: { value: Catalog | null }, config: ParsedArgs, root: string) {
  const outputData = renderList(result.value!);
  await writeOutput(outputData, config.output);
}

export async function handleInspect(result: { value: Catalog | null }, config: ParsedArgs, root: string) {
  if (!config.target) {
    console.error("Error: module name is required. Example: blueprint inspect billing");
    process.exit(1);
  }
  const mod = result.value!.modules.find((m) => m.name === config.target);
  if (!mod) {
    console.error(`Module not found: ${config.target}`);
    process.exit(1);
  }
  const outputData = JSON.stringify(mod, null, config.compact ? undefined : 2);
  await writeOutput(outputData, config.output);
}

export async function handleGraph(result: { value: Catalog | null }, config: ParsedArgs, root: string) {
  if (!config.target) {
    console.error("Error: module name is required. Example: blueprint graph billing");
    process.exit(1);
  }
  const graph = buildGraph(result.value!, config.target);
  if (graph.nodes.length === 0) {
    console.error(`Module not found: ${config.target}`);
    process.exit(1);
  }
  const outputData = config.format === "mermaid" ? renderMermaid(graph, config.target) : renderAscii(graph, config.target);
  await writeOutput(outputData, config.output);
}

export async function handleSearch(result: { value: Catalog | null }, config: ParsedArgs, root: string) {
  let query = config.query;
  if (!query && !process.stdin.isTTY) {
    const input = await readStdin();
    query = input.trim().split("\n")[0]?.trim();
  }
  if (!query) {
    console.error("Error: search query is required. Example: blueprint search billing");
    process.exit(1);
  }
  const results = searchModules(result.value!, query);
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
    const cycles = detectCycles(result.value!);
    if (cycles.length > 0) {
      console.error("Cycle detected:");
      cycles.forEach((c) => console.error(`  ${c.join(" → ")}`));
      process.exit(1);
    }
    const resolved = resolve(result.value!, selected);
    if (resolved.errors.length > 0) {
      console.error("Resolve errors:");
      resolved.errors.forEach((e) => console.error(`  - ${e}`));
      process.exit(1);
    }
    await writeOutput(JSON.stringify(resolved, null, config.compact ? undefined : 2), config.output);
  } else {
    const names = results.map((r) => r.module.name);
    await writeOutput(JSON.stringify(names, null, config.compact ? undefined : 2), config.output);
  }
}

export async function handleResolve(result: { value: Catalog | null }, config: ParsedArgs, root: string) {
  let modules = config.modules;
  if (modules.length === 0 && !process.stdin.isTTY) {
    modules = parseStdinModules(await readStdin());
  }
  if (modules.length === 0) {
    console.error("Error: --modules is required. Example: blueprint resolve --modules billing,payments,users");
    process.exit(1);
  }
  const cycles = detectCycles(result.value!);
  if (cycles.length > 0) {
    console.error("Cycle detected:");
    cycles.forEach((c) => console.error(`  ${c.join(" → ")}`));
    process.exit(1);
  }
  const resolved = resolve(result.value!, modules);
  if (resolved.errors.length > 0) {
    console.error("Resolve errors:");
    resolved.errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  if (resolved.warnings.length > 0 && !config.quiet) {
    resolved.warnings.forEach((w) => console.warn(`  - ${w}`));
  }
  await writeOutput(JSON.stringify(resolved, null, config.compact ? undefined : 2), config.output);
}

export async function handleAdapters(result: { value: Catalog | null }, config: ParsedArgs, root: string) {
  const adaptersDir = join(root, "adapters");
  const { adapters, errors: loadErrors } = await loadAdapters(adaptersDir);
  if (loadErrors.length > 0 && !config.quiet) loadErrors.forEach((e) => console.warn(`  - ${e}`));

  let filteredAdapters = adapters;
  if (config.language) {
    const { adapterSupportsLanguage } = await import("../core/adapters/types.js");
    filteredAdapters = adapters.filter((a) => adapterSupportsLanguage(a, config.language!));
  }

  if (config.adapterSubcommand === "list") {
    const byModule = listAdaptersByModule(filteredAdapters);
    await writeOutput(renderAdapterList(byModule, config.query), config.output);
  } else if (config.adapterSubcommand === "add") {
    if (!config.provider || !config.module) {
      console.error("Error: provider and module required. Example: blueprint adapters add stripe payments");
      process.exit(1);
    }
    const { selection, error } = await addAdapter(root, config.module, config.provider);
    if (error) { console.error(`Error: ${error}`); process.exit(1); }
    console.log(`Added ${config.provider} as adapter for ${config.module}`);
    await writeOutput(JSON.stringify(selection, null, config.compact ? undefined : 2), config.output);
  } else if (config.adapterSubcommand === "remove") {
    if (!config.module) {
      console.error("Error: module is required. Example: blueprint adapters remove payments");
      process.exit(1);
    }
    const { selection, error } = await removeAdapter(root, config.module);
    if (error) { console.error(`Error: ${error}`); process.exit(1); }
    console.log(`Removed adapter for ${config.module}`);
    await writeOutput(JSON.stringify(selection, null, config.compact ? undefined : 2), config.output);
  } else if (config.adapterSubcommand === "show") {
    const { selection } = await loadSelection(root);
    await writeOutput(JSON.stringify(selection, null, config.compact ? undefined : 2), config.output);
  } else if (config.adapterSubcommand === "verify") {
    const { selection } = await loadSelection(root);
    const resolution = resolveAdapters(selection, adapters, result.value!);
    if (resolution.issues.length > 0) {
      resolution.issues.forEach((issue) => {
        const msg = `${issue.adapter ? `${issue.adapter} → ` : ""}${issue.module}: ${issue.message}`;
        if (issue.severity === "error") console.error(`  ERROR: ${msg}`);
        else if (!config.quiet) console.warn(`  WARN: ${msg}`);
      });
      if (resolution.issues.some((i) => i.severity === "error")) process.exit(1);
    } else {
      console.log("All adapters verified successfully.");
    }
    await writeOutput(JSON.stringify(resolution, null, config.compact ? undefined : 2), config.output);
  } else if (config.adapterSubcommand === "search") {
    const query = config.query ?? "";
    const results = adapters.filter((a) => a.name.includes(query) || a.module.includes(query) || a.description?.includes(query));
    await writeOutput(JSON.stringify(results, null, config.compact ? undefined : 2), config.output);
  } else {
    console.error("Error: adapter subcommand required. Available: list, add, remove, show, verify, search");
    process.exit(1);
  }
}

export async function handleGenerate(result: { value: Catalog | null }, config: ParsedArgs, root: string) {
  const language = config.language ?? "typescript";
  const type = config.generateSubcommand ?? "all";
  const outputDir = config.output ?? join(root, "generated");
  const adaptersDir = join(root, "adapters");
  const { adapters } = await loadAdapters(adaptersDir);
  const genOpts: Record<string, unknown> = { language, type, module: config.module, provider: config.provider, outputDir };
  if (config.namespace) genOpts.namespace = config.namespace;
  const { written, errors } = await generateAndWrite(result.value!, adapters, genOpts as any);
  if (errors.length > 0) {
    console.error("Generation errors:");
    errors.forEach((e) => console.error(`  - ${e}`));
  }
  console.log(`Generated ${written} files to ${outputDir}`);
}

export async function handlePrototype(result: { value: Catalog | null }, config: ParsedArgs, root: string) {
  const { selection } = await loadSelection(root);
  const adaptersDir = join(root, "adapters");
  const { adapters } = await loadAdapters(adaptersDir);
  const selectedAdapters: Record<string, string> = {};

  for (const [module, adapterRef] of Object.entries(selection.adapters)) {
    selectedAdapters[module] = typeof adapterRef === "string" ? adapterRef : adapterRef.primary;
  }
  if (Object.keys(selectedAdapters).length === 0) {
    console.error("Error: No adapters selected. Use 'blueprint adapters add' first.");
    process.exit(1);
  }
  const moduleName = config.target ?? "my-project";
  const outputDir = config.output ?? join(root, moduleName);
  const lang = config.language ?? "typescript";
  const { files, errors } = generatePrototype(result.value!, adapters, {
    name: moduleName, modules: Object.keys(selectedAdapters), adapters: selectedAdapters, outputDir, language: lang,
  });
  if (errors.length > 0) {
    console.error("Prototype generation errors:");
    errors.forEach((e) => console.error(`  - ${e}`));
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
}

export async function handleSchema(result: { value: Catalog | null }, config: ParsedArgs, root: string) {
  const outputData = JSON.stringify(generateJsonSchema(result.value!), null, config.compact ? undefined : 2);
  await writeOutput(outputData, config.output);
}

export async function handleBuild(result: { value: Catalog | null }, config: ParsedArgs, root: string) {
  if (process.exitCode) {
    console.error("Catalog has errors. Use --strict to fail on errors, or fix the issues above.");
    process.exit(1);
  }
  const outputData = config.minimal
    ? JSON.stringify(minimalCatalog(result.value!), null, config.compact ? undefined : 2)
    : JSON.stringify(result.value, null, config.compact ? undefined : 2);
  await writeOutput(outputData, config.output);
}

export async function handleImplement(result: { value: Catalog | null }, config: ParsedArgs, root: string) {
  if (!config.module) {
    console.error("Error: --module is required. Example: blueprint implement payments --adapter stripe --prompts");
    process.exit(1);
  }
  if (!config.provider) {
    console.error("Error: --adapter is required. Example: blueprint implement payments --adapter stripe --prompts");
    process.exit(1);
  }

  const adaptersDir = join(root, "adapters");
  const { adapters } = await loadAdapters(adaptersDir);

  const prompts = generateImplementPrompts(result.value!, adapters, config.module, config.provider);

  if (prompts.length === 0) {
    console.error(`No functions to implement for ${config.provider}/${config.module}`);
    process.exit(1);
  }

  if (config.prompts) {
    console.log(`# Implementation prompts for ${config.provider} → ${config.module}`);
    console.log(`# ${prompts.length} functions need implementation\n`);
    for (const p of prompts) {
      console.log(`--- ${p.function} ---`);
      console.log(p.prompt);
      console.log("");
    }
  } else {
    console.log(`${prompts.length} functions ready to implement for ${config.provider}/${config.module}`);
    console.log("Use --prompts to generate AI prompts.");
    for (const p of prompts) {
      console.log(`  - ${p.function}`);
    }
  }
}

export async function handleVerify(result: { value: Catalog | null }, config: ParsedArgs, root: string) {
  if (!config.target) {
    console.error("Error: implementation file is required. Example: blueprint verify ./src/adapters/stripe.ts --module payments");
    process.exit(1);
  }
  if (!config.module) {
    console.error("Error: --module is required. Example: blueprint verify ./src/adapters/stripe.ts --module payments");
    process.exit(1);
  }

  const verification = await verifyImplementation(config.target, config.module, result.value!);

  if (verification.issues.length > 0) {
    console.error(`Verification issues for ${config.module}:`);
    for (const issue of verification.issues) {
      if (issue.kind === "missing") {
        console.error(`  MISSING: ${issue.message}`);
      }
    }
  }

  if (verification.valid) {
    console.log(`\n${config.module}: All ${result.value!.modules.find((m) => m.name === config.module)!.functions.length} functions implemented. ✓`);
  }

  await writeOutput(JSON.stringify(verification, null, config.compact ? undefined : 2), config.output);
}
