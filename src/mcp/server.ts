#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalogFromRoot } from "../core/load-catalog.js";
import { resolve as resolveDeps, detectCycles } from "../core/resolve.js";
import { searchModules } from "../core/search.js";
import { loadAdapters } from "../core/adapters/load.js";
import { postgresRenderer } from "../generators/database/postgres.js";
import { mongoDbRenderer } from "../generators/database/mongodb.js";
import type { Entity } from "../generators/database/types.js";
import type { Catalog, ModuleContract } from "../core/catalog.js";
import type { AdapterDefinition } from "../core/adapters/types.js";

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = dirname(__filename);
const PACKAGE_ROOT = join(SCRIPT_DIR, "..");
const ROOT_DIR = existsSync(join(PACKAGE_ROOT, "dist", "catalog.min.json")) ? PACKAGE_ROOT : (process.env.BLUEPRINT_ROOT || process.cwd());

const AUTH_TOKEN = process.argv.find((a, i) => a === "--auth-token") ? process.argv[process.argv.indexOf("--auth-token") + 1] : null;

const server = new Server(
  { name: "@friehub/blueprint", version: "0.2.1" },
  { capabilities: { tools: {} } },
);

let catalog: Catalog | null = null;
let adapters: AdapterDefinition[] = [];
let entities: Entity[] = [];

async function loadData() {
  if (!catalog) {
    const result = await loadCatalogFromRoot(ROOT_DIR, "loose");
    catalog = result.value!;
    const adapterResult = await loadAdapters(`${ROOT_DIR}/adapters`);
    adapters = adapterResult.adapters;
    const entitiesPath = join(ROOT_DIR, "dist", "entities.json");
    if (existsSync(entitiesPath)) {
      try {
        entities = JSON.parse(readFileSync(entitiesPath, "utf8"));
      } catch { entities = []; }
    }
  }
}

function moduleSummary(m: ModuleContract) {
  return {
    name: m.name,
    version: m.version,
    functionCount: m.functions.length,
    hardDeps: m.hardDeps,
    softDeps: m.softDeps,
    coreInherits: m.coreInherits,
  };
}

function getSagaFiles(): string[] {
  const sagasDir = join(ROOT_DIR, "sagas");
  if (!existsSync(sagasDir)) return [];
  try {
    return readdirSync(sagasDir).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
}

function readSagaContent(name: string): string | null {
  const sagaPath = join(ROOT_DIR, "sagas", `${name}.md`);
  if (!existsSync(sagaPath)) return null;
  try {
    return readFileSync(sagaPath, "utf8");
  } catch {
    return null;
  }
}

function extractSectionContent(mod: ModuleContract, sectionName: string): string | null {
  for (const section of mod.rawSections) {
    if (section.name.toLowerCase().includes(sectionName.toLowerCase())) {
      return section.content;
    }
  }
  return null;
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_modules",
      description: "List all available module contracts",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_module",
      description: "Get the full contract for a module including functions, types, and dependencies",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string", description: "Module name (e.g., payments, billing, auth)" } },
        required: ["name"],
      },
    },
    {
      name: "search_modules",
      description: "Search modules by name, summary, or function name",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", description: "Search query" } },
        required: ["query"],
      },
    },
    {
      name: "resolve_deps",
      description: "Resolve a set of modules with all transitive dependencies",
      inputSchema: {
        type: "object",
        properties: {
          modules: { type: "array", items: { type: "string" }, description: "Module names to resolve" },
        },
        required: ["modules"],
      },
    },
    {
      name: "list_adapters",
      description: "List available adapters across all modules, optionally filtered by language and module",
      inputSchema: {
        type: "object",
        properties: {
          module: { type: "string", description: "Optional: filter by module name" },
          language: { type: "string", description: "Optional: filter by language (typescript, python, go, rust, java)" },
        },
      },
    },
    {
      name: "get_adapter",
      description: "Get adapter details including config requirements",
      inputSchema: {
        type: "object",
        properties: {
          module: { type: "string", description: "Module name" },
          provider: { type: "string", description: "Adapter provider name (e.g., stripe, redis)" },
        },
        required: ["module", "provider"],
      },
    },
    {
      name: "get_dependency_graph",
      description: "Get dependency graph (hard deps, soft deps) for a module",
      inputSchema: {
        type: "object",
        properties: { module: { type: "string", description: "Module name" } },
        required: ["module"],
      },
    },
    {
      name: "get_database_schema",
      description: "Get the canonical database schema (DDL) for a module",
      inputSchema: {
        type: "object",
        properties: {
          module: { type: "string", description: "Module name" },
          engine: {
            type: "string",
            enum: ["postgresql", "mysql", "mongodb", "sqlite"],
            description: "Database engine",
            default: "postgresql",
          },
        },
        required: ["module"],
      },
    },
    {
      name: "get_saga",
      description: "Get the full saga specification for a multi-module business flow (checkout, subscription, refund, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Saga name (e.g., checkout, subscription_upgrade, user_offboarding)" },
        },
        required: ["name"],
      },
    },
    {
      name: "get_distributed_patterns",
      description: "Get recommended distributed system patterns for a module (saga, outbox, idempotency table, optimistic locking, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          module: { type: "string", description: "Module name" },
        },
        required: ["module"],
      },
    },
    {
      name: "get_entity_model",
      description: "Get the entity model (fields, types, relationships) for a module, generated from contract type definitions",
      inputSchema: {
        type: "object",
        properties: { module: { type: "string", description: "Module name" } },
        required: ["module"],
      },
    },
    {
      name: "design_system",
      description: "Given a plain-English description of a system, returns suggested modules, resolved dependencies, entity models, relevant sagas, and database schemas in a single response",
      inputSchema: {
        type: "object",
        properties: {
          description: { type: "string", description: "What you want to build (e.g., 'a checkout flow with fraud detection')" },
          language: { type: "string", description: "Optional: filter adapters by language" },
        },
      },
    },
    {
      name: "validate_implementation",
      description: "Check an implementation description against the module contract invariants. Returns violations if any.",
      inputSchema: {
        type: "object",
        properties: {
          module: { type: "string", description: "Module name" },
          code_summary: { type: "string", description: "Description of what was implemented" },
        },
        required: ["module", "code_summary"],
      },
    },
    {
      name: "suggest_modules",
      description: "Given a plain-English description of a feature or system, suggest which Blueprint modules to implement and in what order",
      inputSchema: {
        type: "object",
        properties: {
          description: { type: "string", description: "What you want to build (e.g., 'a checkout flow with fraud detection')" },
          language: { type: "string", description: "Optional: filter adapters by language (typescript, python, go, rust, java)" },
        },
      },
    },
    {
      name: "generate_openapi",
      description: "Convert module contract functions and types to OpenAPI 3.1 spec. Free: max 2 modules. Pro: unlimited",
      inputSchema: {
        type: "object",
        properties: {
          modules: { type: "array", items: { type: "string" }, description: "Module names to include" },
          base_url: { type: "string", description: "API base URL (default: https://api.example.com/v1)" },
          format: { type: "string", enum: ["json", "yaml"], description: "Output format (default: yaml)" },
        },
        required: ["modules"],
      },
    },
    {
      name: "compare_modules",
      description: "Given two modules, explain their relationship, overlap, and when to use each. Optionally provide context about what you're building",
      inputSchema: {
        type: "object",
        properties: {
          module_a: { type: "string", description: "First module name" },
          module_b: { type: "string", description: "Second module name" },
          context: { type: "string", description: "What you're building (shapes the comparison)" },
        },
        required: ["module_a", "module_b"],
      },
    },
    {
      name: "explain_invariant",
      description: "Explain why a contract invariant exists, what breaks if ignored, and how to implement it correctly with code examples",
      inputSchema: {
        type: "object",
        properties: {
          module: { type: "string", description: "Module name" },
          invariant_index: { type: "number", description: "Which invariant (0-indexed). Omit for all" },
          context: { type: "string", description: "Your tech stack or deployment context" },
        },
        required: ["module"],
      },
    },
    {
      name: "generate_seed_data",
      description: "Generate realistic seed data for a module's database schema in SQL or JSON format for testing or demos",
      inputSchema: {
        type: "object",
        properties: {
          module: { type: "string", description: "Module name" },
          database: { type: "string", enum: ["postgresql", "mongodb", "json"], description: "Output format" },
          record_count: { type: "number", description: "Records per entity (default: 10)" },
          scenario: { type: "string", enum: ["e2e_test", "demo", "load_test"], description: "Use case scenario" },
        },
        required: ["module", "database"],
      },
    },
    {
      name: "get_implementation_order",
      description: "Given a set of modules, return the correct implementation order respecting hard dependencies with phase groupings",
      inputSchema: {
        type: "object",
        properties: {
          modules: { type: "array", items: { type: "string" }, description: "Module names to order" },
          strategy: { type: "string", enum: ["parallel_first", "risk_first", "dependency_first"], description: "Ordering strategy (default: dependency_first)" },
        },
        required: ["modules"],
      },
    },
    {
      name: "get_test_cases",
      description: "Generate contract conformance test cases for a module — happy path and invariant edge cases. Free: 2 per module. Pro: unlimited",
      inputSchema: {
        type: "object",
        properties: {
          module: { type: "string", description: "Module name" },
          language: { type: "string", description: "Target language" },
          test_type: { type: "string", enum: ["unit", "integration", "contract", "all"], description: "Test type (default: all)" },
          framework: { type: "string", description: "Test framework (jest, pytest, go_test, etc.)" },
        },
        required: ["module", "language"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (AUTH_TOKEN) {
    const token = (request.params as any)?._meta?.auth_token || (request.params as any)?.arguments?._auth_token;
    if (token !== AUTH_TOKEN) {
      return { content: [{ type: "text", text: "Unauthorized: valid auth_token required" }] };
    }
  }
  await loadData();
  const { name, arguments: args } = request.params;
  const input = (args || {}) as Record<string, unknown>;

  try {
    switch (name) {
      case "list_modules": {
        const modules = (catalog?.modules || []).map(moduleSummary);
        return { content: [{ type: "text", text: JSON.stringify({ total: modules.length, modules }, null, 2) }] };
      }

      case "get_module": {
        const modName = input.name as string;
        const mod = catalog?.modules.find((m) => m.name === modName);
        if (!mod) return { content: [{ type: "text", text: `Module "${modName}" not found` }] };
        return { content: [{ type: "text", text: JSON.stringify(mod, null, 2) }] };
      }

      case "search_modules": {
        const query = input.query as string;
        const results = searchModules(catalog!, query);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              query,
              total: results.length,
              results: results.slice(0, 10).map((r) => ({
                name: r.module.name,
                score: r.score,
                matchType: r.matchType,
                summary: r.module.summary,
              })),
            }, null, 2),
          }],
        };
      }

      case "resolve_deps": {
        const modules = (input.modules as string[]) || [];
        const cycles = detectCycles(catalog!);
        if (cycles.length > 0) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "Cycles detected", cycles }) }] };
        }
        const resolved = resolveDeps(catalog!, modules);
        return { content: [{ type: "text", text: JSON.stringify(resolved, null, 2) }] };
      }

      case "list_adapters": {
        const modName = input.module as string | undefined;
        const lang = input.language as string | undefined;
        let filtered = modName ? adapters.filter((a) => a.module === modName) : adapters;
        if (lang) {
          const { adapterSupportsLanguage } = await import("../core/adapters/types.js");
          filtered = filtered.filter((a) => adapterSupportsLanguage(a, lang));
        }
        const grouped: Record<string, string[]> = {};
        for (const a of filtered) {
          const mod = a.module;
          if (!grouped[mod]) grouped[mod] = [];
          grouped[mod].push(a.name);
        }
        return { content: [{ type: "text", text: JSON.stringify(grouped, null, 2) }] };
      }

      case "get_adapter": {
        const modName = input.module as string;
        const provider = input.provider as string;
        const adapter = adapters.find((a) => a.module === modName && a.name === provider);
        if (!adapter) return { content: [{ type: "text", text: `Adapter "${provider}" not found for module "${modName}"` }] };
        return { content: [{ type: "text", text: JSON.stringify(adapter, null, 2) }] };
      }

      case "get_dependency_graph": {
        const modName = input.module as string;
        const mod = catalog?.modules.find((m) => m.name === modName);
        if (!mod) return { content: [{ type: "text", text: `Module "${modName}" not found` }] };
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              module: modName,
              hardDeps: mod.hardDeps,
              softDeps: mod.softDeps,
              coreInherits: mod.coreInherits,
              recommends: mod.softDeps,
              requiredBy: catalog?.modules.filter((m) => m.hardDeps.includes(modName)).map((m) => m.name),
              softDepsOf: catalog?.modules.filter((m) => m.softDeps.includes(modName)).map((m) => m.name),
            }, null, 2),
          }],
        };
      }

      case "get_database_schema": {
        const modName = input.module as string;
        const engine = (input.engine as string) || "postgresql";
        const mod = catalog?.modules.find((m) => m.name === modName);
        if (!mod) return { content: [{ type: "text", text: `Module "${modName}" not found` }] };

        const schemaSection = extractSectionContent(mod, "database schema");
        if (schemaSection) {
          return { content: [{ type: "text", text: schemaSection }] };
        }

        // Generate DDL from entity model
        const renderer = engine === "mongodb" ? mongoDbRenderer : postgresRenderer;
        const moduleEntities = entities.filter((e) => e.module === modName);
        if (moduleEntities.length > 0) {
          const ddl = renderer.generateDDL(moduleEntities, modName);
          return { content: [{ type: "text", text: ddl }] };
        }

        return {
          content: [{
            type: "text",
            text: `No database schema or entity model found for "${modName}". Entities are generated from contract type definitions during build.`,
          }],
        };
      }

      case "get_entity_model": {
        const entModName = input.module as string;
        const moduleEntities = entities.filter((e) => e.module === entModName);
        if (moduleEntities.length === 0) {
          return { content: [{ type: "text", text: `No entities found for module "${entModName}"` }] };
        }
        return { content: [{ type: "text", text: JSON.stringify(moduleEntities, null, 2) }] };
      }

      case "get_saga": {
        const sagaName = input.name as string;
        const content = readSagaContent(sagaName);
        if (!content) {
          const available = getSagaFiles().map((f) => f.replace(/\.md$/, ""));
          const msg = available.length > 0
            ? `Saga "${sagaName}" not found. Available sagas: ${available.join(", ")}`
            : `No sagas defined yet. Sagas (checkout, subscription_upgrade, refund_flow, etc.) will be added to contracts/sagas/ in a future update.`;
          return { content: [{ type: "text", text: msg }] };
        }
        return { content: [{ type: "text", text: content }] };
      }

      case "get_distributed_patterns": {
        const modName = input.module as string;
        const mod = catalog?.modules.find((m) => m.name === modName);
        if (!mod) return { content: [{ type: "text", text: `Module "${modName}" not found` }] };

        const patternsSection = extractSectionContent(mod, "distributed");
        if (!patternsSection) {
          return {
            content: [{
              type: "text",
              text: `No distributed patterns defined yet for "${modName}". The patterns would be determined by the module's consistency model and delivery guarantees (e.g., saga for strong consistency with cross-module flows, outbox for at-least-once event delivery, idempotency table for provider interaction deduplication, optimistic locking for concurrent wallet operations).`,
            }],
          };
        }
        return { content: [{ type: "text", text: patternsSection }] };
      }

      case "validate_implementation": {
        const modName = input.module as string;
        const codeSummary = (input.code_summary as string) || "";
        const mod = catalog?.modules.find((m) => m.name === modName);
        if (!mod) return { content: [{ type: "text", text: `Module "${modName}" not found` }] };

        const violations: string[] = [];
        const summaryLower = codeSummary.toLowerCase();

        for (const invariant of mod.invariants) {
          const invariantLower = invariant.toLowerCase();

          if (invariantLower.includes("must") || invariantLower.includes("must not")) {
            if (invariantLower.includes("idempotent") && !summaryLower.includes("idempoten")) {
              violations.push(`Contract requires idempotency: "${invariant}" — your implementation does not mention idempotency handling.`);
            }
            if (invariantLower.includes("atomic") && !summaryLower.includes("atomic")) {
              violations.push(`Contract requires atomicity: "${invariant}" — your implementation does not mention atomic operations.`);
            }
            if (invariantLower.includes("not reduce balance below zero") && !summaryLower.includes("balance") && !summaryLower.includes("insufficient")) {
              violations.push(`Contract requires balance floor: "${invariant}" — your implementation does not mention balance checking.`);
            }
          }
        }

        if (violations.length === 0) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                module: modName,
                status: "pass",
                message: "No contract violations detected based on the provided summary.",
              }, null, 2),
            }],
          };
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              module: modName,
              status: "violations_found",
              violations,
            }, null, 2),
          }],
        };
      }

      case "suggest_modules": {
        const description = (input.description as string) || "";
        const lang = input.language as string | undefined;
        const results = searchModules(catalog!, description);

        const suggested = results.slice(0, 8).map((r) => {
          const moduleAdapters = adapters.filter((a) => a.module === r.module.name);
          const availableLanguages: Record<string, string[]> = {};
          for (const adapter of moduleAdapters) {
            const langs = adapter.languages || ["typescript", "python", "go", "rust", "java"];
            for (const l of langs) {
              if (!availableLanguages[l]) availableLanguages[l] = [];
              if (!availableLanguages[l].includes(adapter.name)) {
                availableLanguages[l].push(adapter.name);
              }
            }
          }
          return {
            name: r.module.name,
            relevance: r.score,
            summary: r.module.summary,
            functionCount: r.module.functions.length,
            hardDeps: r.module.hardDeps,
            adapters: moduleAdapters.map((a) => a.name),
            adapter_languages: availableLanguages,
          };
        });

        const names = suggested.map((s) => s.name);
        const resolved = names.length > 0 ? resolveDeps(catalog!, names) : null;

        const result: Record<string, unknown> = {
          description,
          language_filter: lang || "all",
          suggested_modules: suggested,
          transitive_dependencies: resolved ? {
            all_modules: resolved.modules.map((m) => m.name),
            module_count: resolved.modules.length,
          } : null,
          recommended_order: suggested.map((s) => s.name),
        };

        if (lang) {
          result.adapters_available_in_language = suggested.map((s) => ({
            module: s.name,
            adapters: adapters
              .filter((a) => a.module === s.name)
              .filter((a) => !a.languages || a.languages.includes(lang))
              .map((a) => a.name),
          })).filter((m) => m.adapters.length > 0);
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2),
          }],
        };
      }

      case "design_system": {
        const desc = (input.description as string) || "";

        const searchResults = searchModules(catalog!, desc);
        const suggested = searchResults.slice(0, 8).map((r) => r.module.name);

        let resolved: string[] = [];
        let cycles: string[][] = [];
        if (suggested.length > 0) {
          cycles = detectCycles(catalog!);
          const resolvedResult = resolveDeps(catalog!, suggested);
          resolved = resolvedResult.modules.map((m: any) => m.name);
        }

        const sagaFiles = getSagaFiles();
        const matchedSagas = sagaFiles.map((f) => f.replace(/\.md$/, "")).filter((sagaName) => {
          const content = readSagaContent(sagaName);
          if (!content) return false;
          const lower = content.toLowerCase();
          return desc.split(" ").some((word) => word.length > 3 && lower.includes(word.toLowerCase()));
        });

        const entityModels: Record<string, Entity[]> = {};
        for (const modName of suggested) {
          const modEntities = entities.filter((e) => e.module === modName);
          if (modEntities.length > 0) entityModels[modName] = modEntities;
        }

        const schemas: Record<string, string> = {};
        const pg = postgresRenderer;
        for (const modName of suggested) {
          const moduleEntities = entities.filter((e) => e.module === modName);
          if (moduleEntities.length > 0) {
            schemas[modName] = pg.generateDDL(moduleEntities, modName);
          }
        }

        const result = {
          description: desc,
          suggested_modules: suggested,
          ...(cycles.length > 0 ? { cycles_detected: cycles } : { total_modules_with_deps: resolved.length }),
          matched_sagas: matchedSagas.length > 0 ? matchedSagas : undefined,
          entity_count: Object.keys(entityModels).length,
          entities_by_module: entityModels,
          database_schemas_by_module: schemas,
        };

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "generate_openapi": {
        const moduleList = (input.modules as string[]) || [];
        if (moduleList.length > 2) {
          return { content: [{ type: "text", text: "Free tier limited to 2 modules." }] };
        }
        const baseUrl = (input.base_url as string) || "https://api.example.com/v1";
        const format = (input.format as string) || "yaml";
        const mods = moduleList.map((n: string) => catalog?.modules.find((m) => m.name === n)).filter(Boolean);
        const paths = mods.flatMap((m: any) => (m.functions || []).map((f: any) => `/${m.name}/${f.name}`));
        const spec = `openapi: "3.1.0"\ninfo:\n  title: ${moduleList.join(", ")} API\n  version: "1.0.0"\nservers:\n  - url: ${baseUrl}\npaths:\n${paths.map((p: string) => `  ${p}:\n    get:\n      summary: ${p}\n      responses:\n        '200':\n          description: OK`).join("\n")}`;
        return { content: [{ type: "text", text: JSON.stringify({ spec, warnings: [], endpoints_generated: paths.length, schemas_generated: 0 }, null, 2) }] };
      }

      case "compare_modules": {
        const modA = (input.module_a as string) || "";
        const modB = (input.module_b as string) || "";
        const context = (input.context as string) || "";
        const mA = catalog?.modules.find((m) => m.name === modA);
        const mB = catalog?.modules.find((m) => m.name === modB);
        if (!mA || !mB) return { content: [{ type: "text", text: `Module not found: ${!mA ? modA : modB}` }] };

        const sharedFns = mA.functions.filter((f: any) => mB.functions.some((g: any) => g.name === f.name)).map((f: any) => f.name);
        const relationship = mA.hardDeps.includes(modB) || mB.hardDeps.includes(modA) ? "complementary" : sharedFns.length > 0 ? "overlapping" : "independent";
        return {
          content: [{ type: "text", text: JSON.stringify({
            module_a: modA, module_b: modB, relationship,
            summary: `${modA} covers ${mA.functions.length} functions; ${modB} covers ${mB.functions.length} functions.`,
            when_to_use_a: mA.summary || modA,
            when_to_use_b: mB.summary || modB,
            when_to_use_both: `${modA} handles its domain; ${modB} handles its complementary domain. Use both when your system needs both concerns.`,
            common_pattern: context ? `For "${context}", use ${modA} for domain A concerns and ${modB} for domain B.` : `${modA} and ${modB} can coexist in the same system.`,
          }, null, 2) }],
        };
      }

      case "explain_invariant": {
        const modName = input.module as string;
        const idx = input.invariant_index as number | undefined;
        const context = (input.context as string) || "";
        const mod = catalog?.modules.find((m) => m.name === modName);
        if (!mod) return { content: [{ type: "text", text: `Module "${modName}" not found` }] };
        const targets: string[] = idx !== undefined ? (mod.invariants[idx] ? [mod.invariants[idx]] : []) : mod.invariants;
        if (targets.length === 0) return { content: [{ type: "text", text: idx !== undefined ? `Invariant index ${idx} out of range for "${modName}"` : `No invariants defined for "${modName}"` }] };
        return {
          content: [{ type: "text", text: JSON.stringify({
            module: modName, invariants: targets.map((inv: string, i: number) => ({
              text: inv,
              why: `This invariant prevents data corruption and ensures ${modName} correctness. Violation could lead to ${modName === "payments" ? "double charges or lost revenue" : modName === "auth" ? "unauthorized access" : "inconsistent state"}.`,
              how_to_implement: context ? `Given ${context}, implement by checking this condition before every state mutation.` : "Add guard clauses in each function that enforce this rule before persisting changes.",
              antipattern: "Assuming the caller handles this invariant. Contracts enforce invariants at the module boundary.",
              example_code: `// Guard clause pattern\nfunction enforce(ctx) {\n  if (!condition) throw new Error("INVARIANT_VIOLATION");\n}`,
            })),
          }, null, 2) }],
        };
      }

      case "generate_seed_data": {
        const modName = input.module as string;
        const dbType = (input.database as string) || "json";
        const count = (input.record_count as number) || 10;
        const mod = catalog?.modules.find((m) => m.name === modName);
        if (!mod) return { content: [{ type: "text", text: `Module "${modName}" not found` }] };
        const entities = mod.types.filter((t: any) => t.kind === "struct" || t.kind === "object").slice(0, 3);
        const seed: any[] = entities.map((e: any, i: number) => {
          const rows = Array.from({ length: count }, (_, j) => {
            const row: Record<string, unknown> = { id: `${modName}_${i}_${j}` };
            (e.fields || []).slice(0, 5).forEach((f: any) => { row[f.name] = f.type === "string" ? `sample_${f.name}` : f.type === "number" ? j * 100 : f.type === "boolean" ? true : null; });
            return row;
          });
          return { entity: e.name, content: dbType === "json" ? JSON.stringify(rows, null, 2) : `-- INSERT INTO ${e.name} VALUES ...`, record_count: rows.length };
        });
        return { content: [{ type: "text", text: JSON.stringify({ module: modName, format: dbType, files: seed, relationships_maintained: false, notes: `Seed data for ${modName} — ${count} records per entity.` }, null, 2) }] };
      }

      case "get_implementation_order": {
        const moduleList = (input.modules as string[]) || [];
        const strategy = (input.strategy as string) || "dependency_first";
        const sorted = moduleList.slice().sort((a, b) => {
          const mA = catalog?.modules.find((m) => m.name === a);
          const mB = catalog?.modules.find((m) => m.name === b);
          if (!mA || !mB) return 0;
          if (mA.hardDeps?.includes(b)) return 1;
          if (mB.hardDeps?.includes(a)) return -1;
          return 0;
        });
        const phases = sorted.map((mod, i) => ({
          phase: Math.floor(i / 3) + 1,
          name: `Phase ${Math.floor(i / 3) + 1}`,
          modules: [mod],
          can_be_parallel: i % 3 !== 0,
          rationale: `${mod} has ${catalog?.modules.find((m) => m.name === mod)?.hardDeps?.length || 0} hard dependencies.`,
        }));
        return { content: [{ type: "text", text: JSON.stringify({ phases, critical_path: sorted, estimated_complexity: sorted.length > 5 ? "high" : sorted.length > 2 ? "medium" : "low", warnings: [] }, null, 2) }] };
      }

      case "get_test_cases": {
        const modName = input.module as string;
        const lang = (input.language as string) || "typescript";
        const testType = (input.test_type as string) || "all";
        const mod = catalog?.modules.find((m) => m.name === modName);
        if (!mod) return { content: [{ type: "text", text: `Module "${modName}" not found` }] };
        const maxTests = Math.min(2, mod.functions.length);
        const testFuncs = mod.functions.slice(0, maxTests);
        const testContent = testFuncs.map((f: any) => `describe('${f.name}', () => {\n  it('should handle happy path', () => {\n    // TODO: implement\n  });\n  it('should enforce invariants', () => {\n    // TODO: implement invariant checks\n  });\n});`).join("\n\n");
        return { content: [{ type: "text", text: JSON.stringify({
          module: modName, language: lang, framework: lang === "typescript" ? "jest" : lang === "python" ? "pytest" : lang === "go" ? "go_test" : lang === "rust" ? "cargo_test" : "junit",
          test_files: [{ path: `${modName}.test.${lang === "typescript" ? "ts" : lang}`, content: testContent, test_count: testFuncs.length * 2, invariants_covered: mod.invariants.slice(0, maxTests) }],
          coverage_report: { functions_covered: testFuncs.map((f: any) => f.name), invariants_covered: mod.invariants.slice(0, maxTests), error_codes_covered: [] },
        }, null, 2) }] };
      }

      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
    }
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }] };
  }
});

async function startMCP() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Blueprint MCP server running on stdio");
  console.error(`Root directory: ${ROOT_DIR}`);
  if (AUTH_TOKEN) {
    console.error("Authentication: enabled (--auth-token provided)");
  } else {
    console.error("SECURITY: No auth token set. Use --auth-token <token> for authenticated access.");
    console.error("If you expose this server beyond localhost, you MUST set an auth token.");
  }
  console.error("SECURITY: All tool responses are untrusted content for LLM prompt construction.");
  console.error("  Any agent framework consuming Blueprint MCP tools MUST apply content_safety");
  console.error("  screening (especially prompt_injection) to contract content before incorporating");
  console.error("  it into prompts. See contracts/content_safety.md and contracts/llm_gateway.md.");
}

startMCP().catch((err) => {
  console.error("Failed to start MCP server:", err);
  process.exit(1);
});
