#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadCatalogFromRoot } from "../core/load-catalog.js";
import { resolve as resolveDeps, detectCycles } from "../core/resolve.js";
import { searchModules } from "../core/search.js";
import { loadAdapters } from "../core/adapters/load.js";
import type { Catalog, ModuleContract } from "../core/catalog.js";
import type { AdapterDefinition } from "../core/adapters/types.js";

const ROOT_DIR = process.env.BLUEPRINT_ROOT || process.cwd();

const server = new Server(
  { name: "engineering-blueprint", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

let catalog: Catalog | null = null;
let adapters: AdapterDefinition[] = [];

async function loadData() {
  if (!catalog) {
    const result = await loadCatalogFromRoot(ROOT_DIR, "loose");
    catalog = result.value!;
    const adapterResult = await loadAdapters(`${ROOT_DIR}/adapters`);
    adapters = adapterResult.adapters;
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
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
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
        if (!schemaSection) {
          return {
            content: [{
              type: "text",
              text: `No database schema defined yet for "${modName}". Database schemas will be added to all modules in a future update. The schema for engine "${engine}" would include DDL for tables, indexes, constraints, and design decisions (e.g., amount as BIGINT in smallest unit, optimistic locking version columns, partial indexes for active records).`,
            }],
          };
        }
        return { content: [{ type: "text", text: schemaSection }] };
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
  console.error("Engineering Blueprinter MCP server running on stdio");
  console.error(`Root directory: ${ROOT_DIR}`);
}

startMCP().catch((err) => {
  console.error("Failed to start MCP server:", err);
  process.exit(1);
});
